import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
await db.exec(fs.readFileSync(new URL("./stubs.sql", import.meta.url), "utf8"));
await db.exec(fs.readFileSync(new URL("../migrations/20261023000000_listings_auth_storage.sql", import.meta.url), "utf8"));
await db.exec(fs.readFileSync(new URL("../migrations/20261025000000_inquiries_visits_contact.sql", import.meta.url), "utf8"));
await db.exec(fs.readFileSync(new URL("../migrations/20261029000000_hardening_and_indexes.sql", import.meta.url), "utf8"));

const U = { A: "a0000000-0000-4000-8000-00000000000a", B: "b0000000-0000-4000-8000-00000000000b", R: "c0000000-0000-4000-8000-00000000000c", R2: "d0000000-0000-4000-8000-0000000000d2" };
for (const [k, id] of Object.entries(U)) await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)", [id, k + "@x.test", JSON.stringify({ full_name: "User " + k })]);
await db.query("insert into public.reviewers (user_id) values ($1), ($2)", [U.R, U.R2]);

const as = async (who) => {
  await db.exec("reset role");
  if (who === "admin") return;
  await db.query("select set_config('request.jwt.claims', $1, false)", [who === "anon" ? "" : JSON.stringify({ sub: U[who], role: "authenticated" })]);
  await db.exec(`set role ${who === "anon" ? "anon" : "authenticated"}`);
};
let pass = 0, fail = 0; const failures = [];
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log("PASS", name); } else { fail++; failures.push(name); console.log("FAIL", name, extra); } };
const ok = async (name, fn) => { try { const r = await fn(); check(name, true); return r; } catch (e) { check(name, false, e.message); } };
const denied = async (name, fn, re = /./) => { try { await fn(); check(name, false, "(expected an error but it succeeded)"); } catch (e) { check(name, re.test(e.message), e.message); } };
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
const count = async (sql, p = []) => Number((await rows(sql, p))[0].n);

const base = (t = "Test listing") => [t, "A detailed description that is comfortably longer than thirty characters.", "sale", "house", 12500000, "total", "Kathmandu", "Kathmandu", 3, 2, 1500, 5, ["Parking"], "Owner Name", "+977 9800000000", "o@x.test"];
const INS = "insert into public.properties (title,description,listing_type,property_type,price_npr,price_unit,location,city,bedrooms,bathrooms,area_sqft,land_area_aana,amenities,contact_name,contact_phone,contact_email,status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id";
const addImg = (pid, owner, n = 0) => db.query("insert into public.property_images (property_id, path, position) values ($1,$2,$3)", [pid, `${U[owner]}/${pid}/photo${n}.jpg`, n]);

// ---------- profiles
await as("admin");
check("profile auto-created at sign-up", (await count("select count(*) n from public.profiles")) === 4);
await as("A");
check("user reads only own profile", (await count("select count(*) n from public.profiles")) === 1);
await ok("user updates own profile", () => db.query("update public.profiles set phone='+977 1' where id=$1", [U.A]));
check("cannot update another profile (0 rows)", (await db.query("update public.profiles set phone='x' where id=$1", [U.B])).affectedRows === 0);
await denied("cannot change profile id", () => db.query("update public.profiles set id=$1 where id=$2", [U.B, U.A]), /permission denied/);

// ---------- create listings as customer A
await as("A");
const a1 = (await ok("A creates a draft", () => db.query(INS, [...base("A draft"), "draft"])))?.rows[0].id;
const a2 = (await ok("A creates a pending_review listing", () => db.query(INS, [...base("A pending"), "pending_review"])))?.rows[0].id;
check("owner_id is filled from the signed-in user", (await rows("select owner_id from public.properties where id=$1", [a1]))[0].owner_id === U.A);
await denied("A cannot create a published listing", () => db.query(INS, [...base("sneaky"), "published"]), /draft or pending_review/);
await denied("A cannot choose owner_id (no privilege)", () => db.query("insert into public.properties (owner_id,title,listing_type,property_type,price_npr,location,city,contact_name,contact_phone) values ($1,'Spoofed owner','sale','house',1,'Kathmandu','Kathmandu','X','1')", [U.B]), /permission denied/);
await denied("invalid listing_type rejected", () => db.query(INS, [...base(), "draft"].map((v, i) => (i === 2 ? "lease" : v))), /check constraint/);
await denied("negative price rejected", () => db.query(INS, [...base(), "draft"].map((v, i) => (i === 4 ? -5 : v))), /check constraint/);
await denied("rent must be priced per month", () => db.query(INS, [...base(), "draft"].map((v, i) => (i === 2 ? "rent" : v))), /properties_rent_is_monthly/);
await denied("per-aana pricing only for land", () => db.query(INS, [...base(), "draft"].map((v, i) => (i === 5 ? "aana" : v))), /properties_aana_only_for_land/);
await denied("needs a phone or email", () => db.query(INS, [...base(), "draft"].map((v, i) => (i === 14 || i === 15 ? null : v))), /properties_has_contact/);

// ---------- visibility
await as("anon");
check("anon sees no unpublished listings", (await count("select count(*) n from public.properties")) === 0);
await denied("anon cannot select * (owner_id etc. not granted)", () => db.query("select * from public.properties"), /permission denied/);
await ok("anon can select public columns", () => db.query("select id,title,price_npr from public.properties"));
await denied("anon cannot read owner_id", () => db.query("select owner_id from public.properties"), /permission denied/);
await denied("anon cannot insert", () => db.query(INS, [...base(), "draft"]), /permission denied/);
await as("B");
check("customer B cannot see A's draft/pending", (await count("select count(*) n from public.properties")) === 0);
check("B cannot update A's listing (0 rows)", (await db.query("update public.properties set title='Hacked title' where id=$1", [a1])).affectedRows === 0);
check("B cannot delete A's listing (0 rows)", (await db.query("delete from public.properties where id=$1", [a1])).affectedRows === 0);
await denied("B cannot attach an image to A's listing", () => addImg(a1, "A"), /row-level security|violates/);
await as("A");
check("A sees own listings", (await count("select count(*) n from public.properties")) === 2);

// ---------- submission workflow
await denied("submit needs a photo", () => db.query("update public.properties set status='pending_review' where id=$1", [a1]), /at least one photo/);
await ok("A adds a photo", () => addImg(a1, "A"));
await denied("photo path must be in own listing folder", () => db.query("insert into public.property_images (property_id,path,position) values ($1,$2,1)", [a1, `${U.B}/${a1}/x.jpg`]), /property_images_own_folder|violates/);
await denied("customers cannot set external_url (demo-only)", () => db.query("insert into public.property_images (property_id,external_url,position) values ($1,'http://evil.test/x.jpg',2)", [a1]), /permission denied/);
await ok("A submits draft for review", () => db.query("update public.properties set status='pending_review' where id=$1", [a1]));
await denied("A cannot publish own listing", () => db.query("update public.properties set status='published' where id=$1", [a1]), /cannot change a listing from pending_review to published/);
await denied("A cannot feature own listing", () => db.query("update public.properties set featured=true where id=$1", [a1]), /Only a reviewer/);
await denied("A cannot change owner_id", () => db.query("update public.properties set owner_id=$1 where id=$2", [U.B, a1]), /permission denied/);
await denied("A cannot fake review fields", () => db.query("update public.properties set rejection_reason='fake reason for test' where id=$1", [a1]), /Only a reviewer/);
await ok("A withdraws submission back to draft", () => db.query("update public.properties set status='draft' where id=$1", [a1]));
await ok("A resubmits", () => db.query("update public.properties set status='pending_review' where id=$1", [a1]));

// ---------- reviewer workflow
await as("R");
check("reviewer sees all listings", (await count("select count(*) n from public.properties")) === 2);
check("reviewer sees pending_review queue", (await count("select count(*) n from public.properties where status='pending_review'")) === 2);
await denied("reviewer cannot edit listing content", () => db.query("update public.properties set title='Edited by reviewer' where id=$1", [a1]), /only change moderation/);
await denied("reviewer cannot approve a listing without photos", () => db.query("update public.properties set status='published' where id=$1", [a2]), /at least one photo/);
await denied("reviewer must give a rejection reason", () => db.query("update public.properties set status='rejected' where id=$1", [a2]), /reason/);
await ok("reviewer rejects with a reason", () => db.query("update public.properties set status='rejected', rejection_reason='Photos are missing and the price looks wrong.' where id=$1", [a2]));
await denied("reviewer cannot write reviewed_by directly (no privilege)", () => db.query("update public.properties set status='published', reviewed_by=$2 where id=$1", [a1, U.B]), /permission denied/);
await ok("reviewer approves listing with photos and features it", () => db.query("update public.properties set status='published', featured=true where id=$1", [a1]));
await as("admin");
const rv = (await rows("select status,featured,reviewed_by,reviewed_at is not null as stamped,rejection_reason from public.properties where id=$1", [a1]))[0];
check("approval recorded: published + featured", rv.status === "published" && rv.featured === true);
check("reviewed_by is set by the database to the real reviewer", rv.reviewed_by === U.R, rv.reviewed_by);
check("reviewed_at stamped", rv.stamped === true);
await as("A");
check("owner sees the rejection reason on their rejected listing", (await rows("select rejection_reason from public.properties where id=$1", [a2]))[0].rejection_reason.includes("Photos are missing"));
await ok("owner resubmits a rejected listing after fixing", async () => { await addImg(a2, "A"); await db.query("update public.properties set status='pending_review' where id=$1", [a2]); });
await as("anon");
check("anon now sees the one published listing", (await count("select count(*) n from public.properties")) === 1);
check("anon sees its photo row", (await count("select count(*) n from public.property_images")) === 1);
await as("B");
check("B (another customer) sees published listing only", (await count("select count(*) n from public.properties")) === 1);

// reviewer cannot review their own listing
await as("R");
const r1 = (await db.query(INS, [...base("Reviewer's own listing"), "draft"])).rows[0].id;
await addImg(r1, "R");
await db.query("update public.properties set status='pending_review' where id=$1", [r1]);
await denied("reviewer cannot approve their OWN listing", () => db.query("update public.properties set status='published' where id=$1", [r1]), /cannot change a listing from pending_review to published/);
await as("R2");
await ok("a different reviewer can approve it", () => db.query("update public.properties set status='published' where id=$1", [r1]));

// ---------- reviewer privilege cannot be self-granted
await as("A");
await denied("customer cannot grant themselves reviewer", () => db.query("insert into public.reviewers (user_id) values ($1)", [U.A]), /permission denied/);
await denied("customer cannot edit reviewers", () => db.query("delete from public.reviewers"), /permission denied/);
check("customer only sees own reviewer row (none)", (await count("select count(*) n from public.reviewers")) === 0);
await as("R");
check("reviewer sees own reviewer row only", (await count("select count(*) n from public.reviewers")) === 1);
await denied("reviewer cannot add other reviewers via API", () => db.query("insert into public.reviewers (user_id) values ($1)", [U.B]), /permission denied/);
check("is_reviewer() true for reviewer", (await rows("select public.is_reviewer() v"))[0].v === true);
await as("A");
check("is_reviewer() false for customer", (await rows("select public.is_reviewer() v"))[0].v === false);
await as("anon");
await denied("anon cannot call is_reviewer() (execute revoked)", () => db.query("select public.is_reviewer()"), /permission denied/);
await denied("anon cannot call handle_new_user()", () => db.query("select public.handle_new_user()"), /permission denied/);
await as("A");
await denied("signed-in users cannot call handle_new_user() either", () => db.query("select public.handle_new_user()"), /permission denied/);
await as("admin");
await db.query("insert into auth.users (id,email,raw_user_meta_data) values ('f0000000-0000-4000-8000-0000000000f1','new@x.test','{\"full_name\":\"Trigger Test\"}')");
check("signup trigger still creates the profile after the hardening", (await count("select count(*) n from public.profiles where id='f0000000-0000-4000-8000-0000000000f1'")) === 1);
await as("anon");

// ---------- editing a live listing returns it to review
await as("A");
await ok("A edits the title of a published listing", () => db.query("update public.properties set title='Edited published title' where id=$1", [a1]));
let st = (await rows("select status,featured from public.properties where id=$1", [a1]))[0];
check("edited published listing returns to pending_review and loses featured", st.status === "pending_review" && st.featured === false, JSON.stringify(st));
await as("anon");
check("it disappears from public view until re-approved", (await count("select count(*) n from public.properties where id=$1", [a1])) === 0);
await as("R"); await db.query("update public.properties set status='published' where id=$1", [a1]);
await as("A");
await ok("A can mark published listing as sold (availability change, no re-review)", () => db.query("update public.properties set availability='sold' where id=$1", [a1]));
check("still published after availability change", (await rows("select status from public.properties where id=$1", [a1]))[0].status === "published");
await ok("A adds another photo to published listing", () => addImg(a1, "A", 1));
check("adding a photo sends it back to review", (await rows("select status from public.properties where id=$1", [a1]))[0].status === "pending_review");
await as("R"); await db.query("update public.properties set status='published' where id=$1", [a1]);

// ---------- archive / delete rules
await as("A");
await denied("owner cannot delete a published listing (0 rows)", async () => { const r = await db.query("delete from public.properties where id=$1", [a1]); if (r.affectedRows === 0) throw new Error("0 rows deleted"); }, /0 rows deleted/);
await ok("owner archives published listing", () => db.query("update public.properties set status='archived' where id=$1", [a1]));
await as("anon");
check("archived listing hidden from public", (await count("select count(*) n from public.properties where id=$1", [a1])) === 0);
await as("A");
await ok("owner restores archived listing to draft", () => db.query("update public.properties set status='draft' where id=$1", [a1]));
await ok("owner deletes a draft", async () => { const r = await db.query("delete from public.properties where id=$1", [a1]); if (r.affectedRows !== 1) throw new Error("not deleted"); });
await as("admin");
check("deleting a listing removes its image rows (cascade)", (await count("select count(*) n from public.property_images where property_id=$1", [a1])) === 0);

// ---------- generated total price
await as("A");
const land = (await db.query("insert into public.properties (title,listing_type,property_type,price_npr,price_unit,land_area_aana,location,city,contact_name,contact_phone,status) values ('Land per aana test','sale','land',1200000,'aana',8,'Tokha','Kathmandu','Owner','+977 1','draft') returning total_price_npr")).rows[0];
check("total price = per-aana price x land area", Number(land.total_price_npr) === 9600000, land.total_price_npr);

// ---------- favorites
await as("anon");
await denied("anon cannot favorite", () => db.query("insert into public.favorites (property_id) values ($1)", [r1]), /permission denied/);
await as("B");
await ok("B favorites a published listing", () => db.query("insert into public.favorites (property_id) values ($1)", [r1]));
await denied("B cannot favorite A's unpublished listing", () => db.query("insert into public.favorites (property_id) values ($1)", [a2]), /row-level security/);
await as("A");
check("A cannot see B's favorites", (await count("select count(*) n from public.favorites")) === 0);
check("A cannot delete B's favorite (0 rows)", (await db.query("delete from public.favorites where user_id=$1", [U.B])).affectedRows === 0);

// ---------- storage policies
await as("admin");
await db.query("insert into storage.objects (bucket_id,name) values ('property-images',$1)", [`${U.A}/${a2}/photo0.jpg`]); // exists: pending listing a2 image
const pubName = `${U.R}/${r1}/photo0.jpg`;
await db.query("insert into storage.objects (bucket_id,name) values ('property-images',$1)", [pubName]);
check("bucket is private with 5 MB and image-only limits", await (async () => { const b = (await rows("select * from storage.buckets where id='property-images'"))[0]; return b.public === false && Number(b.file_size_limit) === 5242880 && b.allowed_mime_types.join() === "image/jpeg,image/png,image/webp"; })());
await as("anon");
check("anon can read objects of PUBLISHED listings only", (await rows("select name from storage.objects")).map((r) => r.name).join() === pubName);
await as("B");
check("B can read published listing files but not A's pending files", (await rows("select name from storage.objects")).map((r) => r.name).join() === pubName);
await as("A");
check("A reads own files (pending) and published ones", (await count("select count(*) n from storage.objects")) === 2);
await ok("A uploads into own listing folder", () => db.query("insert into storage.objects (bucket_id,name) values ('property-images',$1)", [`${U.A}/${a2}/photo9.jpg`]));
await denied("A cannot upload into another user's folder", () => db.query("insert into storage.objects (bucket_id,name) values ('property-images',$1)", [`${U.B}/${r1}/evil.jpg`]), /row-level security/);
await denied("A cannot upload to a property A does not own", () => db.query("insert into storage.objects (bucket_id,name) values ('property-images',$1)", [`${U.A}/${r1}/evil.jpg`]), /row-level security/);
await denied("uploads to other buckets are not allowed by these policies", async () => { await db.exec("reset role"); await db.query("insert into storage.buckets (id,name) values ('other','other')"); await as("A"); await db.query("insert into storage.objects (bucket_id,name) values ('other',$1)", [`${U.A}/${a2}/x.jpg`]); }, /row-level security/);
check("A cannot delete a file in another user's folder (0 rows)", (await db.query("delete from storage.objects where name=$1", [pubName])).affectedRows === 0);
await ok("A deletes own file", async () => { const r = await db.query("delete from storage.objects where name=$1", [`${U.A}/${a2}/photo9.jpg`]); if (r.affectedRows !== 1) throw new Error("no row"); });
await denied("A cannot overwrite/update files (no UPDATE policy)", async () => { const r = await db.query("update storage.objects set name=name where name=$1", [`${U.A}/${a2}/photo0.jpg`]); if (r.affectedRows === 0) throw new Error("0 rows updated"); }, /0 rows updated/);
await as("R");
check("reviewer can read all listing files", (await count("select count(*) n from storage.objects")) === 2);

console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log("FAILED:", failures);
process.exit(fail ? 1 : 0);
