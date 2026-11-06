// Access-rule checks for inquiries, visit requests and contact messages.
// Run:  cd supabase/tests && npm install --no-save @electric-sql/pglite && node inquiries.test.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const db = new PGlite();
await db.exec(read("./stubs.sql"));
await db.exec(read("../migrations/20261023000000_listings_auth_storage.sql"));
await db.exec(read("../migrations/20261025000000_inquiries_visits_contact.sql"));
await db.exec(read("../migrations/20261029000000_hardening_and_indexes.sql"));

const U = { O: "a0000000-0000-4000-8000-0000000000a1", S: "b0000000-0000-4000-8000-0000000000b2", X: "c0000000-0000-4000-8000-0000000000c3", R: "d0000000-0000-4000-8000-0000000000d4" };
for (const id of Object.values(U)) await db.query("insert into auth.users (id,email) values ($1,$2)", [id, id.slice(0, 4) + "@x.test"]);
await db.query("insert into public.reviewers (user_id) values ($1)", [U.R]);

const mk = async (title, status, availability = "available") => (await db.query(
  `insert into public.properties (owner_id,title,description,listing_type,property_type,price_npr,location,city,area_sqft,contact_name,contact_phone,status,availability)
   values ($1,$2,'A description that is long enough to be valid.','sale','house',9000000,'Kathmandu','Kathmandu',1200,'Owner','+977 9800000000',$3,$4) returning id`, [U.O, title, status, availability])).rows[0].id;
const pub = await mk("Published open", "published"), draft = await mk("Draft one", "draft"), pend = await mk("Pending one", "pending_review"), sold = await mk("Published sold", "published", "sold");

const as = async (who) => {
  await db.exec("reset role");
  if (who === "admin") return;
  await db.query("select set_config('request.jwt.claims', $1, false)", [who === "anon" ? "" : JSON.stringify({ sub: U[who], role: "authenticated" })]);
  await db.exec(`set role ${who === "anon" ? "anon" : "authenticated"}`);
};
let pass = 0, fail = 0; const bad = [];
const check = (n, c, x = "") => { if (c) { pass++; console.log("PASS", n); } else { fail++; bad.push(n); console.log("FAIL", n, x); } };
const ok = async (n, f) => { try { const r = await f(); check(n, true); return r; } catch (e) { check(n, false, e.message); } };
const denied = async (n, f, re = /./) => { try { await f(); check(n, false, "(expected an error)"); } catch (e) { check(n, re.test(e.message), e.message); } };
const count = async (sql, p = []) => Number((await db.query(sql, p)).rows[0].n);
const INQ = "insert into public.inquiries (property_id,name,email,phone,message) values ($1,$2,$3,$4,$5)";
const VIS = "insert into public.visit_requests (property_id,name,email,phone,preferred_date,preferred_time,message) values ($1,$2,$3,$4,$5,$6,$7)";
const CON = "insert into public.contact_messages (name,email,phone,message) values ($1,$2,$3,$4)";
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const good = ["Visitor Name", "visitor@x.test", null, "Is this property still available? I'd like to know more."];

// ---------- sending inquiries
await as("anon");
await ok("visitor can send an inquiry for a published, open listing", () => db.query(INQ, [pub, ...good]));
await denied("inquiry for a nonexistent property is rejected", () => db.query(INQ, ["00000000-0000-4000-8000-000000000000", ...good]), /row-level security|foreign key/);
await denied("inquiry for a draft listing is rejected", () => db.query(INQ, [draft, ...good]), /row-level security/);
await denied("inquiry for a pending_review listing is rejected", () => db.query(INQ, [pend, ...good]), /row-level security/);
await denied("inquiry for a sold listing is rejected", () => db.query(INQ, [sold, ...good]), /row-level security/);
await denied("visitor cannot set sender_id", () => db.query("insert into public.inquiries (property_id,sender_id,name,email,message) values ($1,$2,'Name Here','a@b.co','A long enough message.')", [pub, U.S]), /permission denied/);
await denied("visitor cannot set status", () => db.query("insert into public.inquiries (property_id,status,name,email,message) values ($1,'closed','Name Here','a@b.co','A long enough message.')", [pub]), /permission denied/);
await denied("visitor cannot read inquiries", () => db.query("select * from public.inquiries"), /permission denied/);
await denied("invalid email rejected", () => db.query(INQ, [pub, "Name Here", "not-an-email", null, "A long enough message."]), /check constraint/);
await denied("too-short message rejected", () => db.query(INQ, [pub, "Name Here", "a@b.co", null, "hi"]), /check constraint/);
await denied("too-short name rejected", () => db.query(INQ, [pub, "A", "a@b.co", null, "A long enough message."]), /check constraint/);

await as("S");
await ok("signed-in customer sends an inquiry", () => db.query(INQ, [pub, "Sender S", "s@x.test", "+977 9811111111", "Please call me about this house."]));
check("sender_id is filled by the database", (await db.query("select sender_id from public.inquiries where name='Sender S'")).rows[0].sender_id === U.S);
check("sender can read only their own inquiry", (await count("select count(*) n from public.inquiries")) === 1);
check("sender cannot edit an inquiry (0 rows)", (await db.query("update public.inquiries set status='closed'")).affectedRows === 0);
await denied("sender cannot rewrite message text (no privilege)", () => db.query("update public.inquiries set message='changed message text here'"), /permission denied/);
await denied("nobody can delete inquiries through the API", () => db.query("delete from public.inquiries"), /permission denied/);

// ---------- who can read
await as("X");
check("an unrelated customer sees no inquiries", (await count("select count(*) n from public.inquiries")) === 0);
await as("O");
check("listing owner sees inquiries about their listing", (await count("select count(*) n from public.inquiries")) === 2);
await ok("owner marks an inquiry as contacted", async () => { const r = await db.query("update public.inquiries set status='contacted' where name='Sender S'"); if (r.affectedRows !== 1) throw new Error("not updated"); });
await denied("owner cannot set an invalid status", () => db.query("update public.inquiries set status='spam'"), /check constraint/);
await denied("owner cannot edit what the sender wrote", () => db.query("update public.inquiries set email='x@y.co'"), /permission denied/);
await as("R");
check("reviewer can read all inquiries", (await count("select count(*) n from public.inquiries")) === 2);
check("reviewer cannot change inquiry status (0 rows)", (await db.query("update public.inquiries set status='closed'")).affectedRows === 0);
await as("admin");
check("updated_at moves when status changes", (await db.query("select updated_at >= created_at as ok from public.inquiries where name='Sender S'")).rows[0].ok === true);

// ---------- visit requests
await as("anon");
await ok("visitor can request a visit for a future date", () => db.query(VIS, [pub, "Visitor Name", "v@x.test", "+977 9822222222", tomorrow, "morning", null]));
await denied("visit in the past is rejected", () => db.query(VIS, [pub, "Visitor Name", "v@x.test", "+977 9822222222", yesterday, "morning", null]), /row-level security/);
await denied("invalid time slot rejected", () => db.query(VIS, [pub, "Visitor Name", "v@x.test", "+977 9822222222", tomorrow, "midnight", null]), /check constraint/);
await denied("phone is required for a visit request", () => db.query(VIS, [pub, "Visitor Name", "v@x.test", null, tomorrow, "morning", null]), /not-null|null value/);
await denied("visit for an unpublished listing rejected", () => db.query(VIS, [draft, "Visitor Name", "v@x.test", "+977 9822222222", tomorrow, "morning", null]), /row-level security/);
await denied("visitor cannot read visit requests", () => db.query("select * from public.visit_requests"), /permission denied/);
await as("X");
check("unrelated customer sees no visit requests", (await count("select count(*) n from public.visit_requests")) === 0);
await as("O");
check("owner sees visit requests for their listing", (await count("select count(*) n from public.visit_requests")) === 1);
await ok("owner confirms a visit request", async () => { const r = await db.query("update public.visit_requests set status='confirmed'"); if (r.affectedRows !== 1) throw new Error("not updated"); });
await as("R");
check("reviewer can read visit requests", (await count("select count(*) n from public.visit_requests")) === 1);

// ---------- contact messages
await as("anon");
await ok("visitor can send a contact message", () => db.query(CON, ["Visitor Name", "v@x.test", null, "I would like to partner with EstateHub."]));
await denied("visitor cannot read contact messages", () => db.query("select * from public.contact_messages"), /permission denied/);
await denied("visitor cannot set sender_id on a contact message", () => db.query("insert into public.contact_messages (sender_id,name,email,message) values ($1,'Name Here','a@b.co','A long enough message.')", [U.S]), /permission denied/);
await denied("short contact message rejected", () => db.query(CON, ["Visitor Name", "v@x.test", null, "hi"]), /check constraint/);
await as("S");
await ok("signed-in customer can send a contact message", () => db.query(CON, ["Sender S", "s@x.test", null, "Question about listing my property."]));
check("customers cannot read contact messages (0 rows)", (await count("select count(*) n from public.contact_messages")) === 0);
check("customers cannot change contact messages (0 rows)", (await db.query("update public.contact_messages set status='read'")).affectedRows === 0);
await as("O");
check("property owners cannot read contact messages", (await count("select count(*) n from public.contact_messages")) === 0);
await as("R");
check("reviewer can read contact messages", (await count("select count(*) n from public.contact_messages")) === 2);
await ok("reviewer can mark a contact message as read", async () => { const r = await db.query("update public.contact_messages set status='read'"); if (r.affectedRows !== 2) throw new Error("not updated"); });

// ---------- housekeeping
await as("admin");
await db.query("delete from public.properties where id=$1", [pub]);
check("deleting a property removes its inquiries and visit requests", (await count("select count(*) n from public.inquiries")) === 0 && (await count("select count(*) n from public.visit_requests")) === 0);

console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log("FAILED:", bad);
process.exit(fail ? 1 : 0);
