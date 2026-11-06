import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AMENITY_OPTIONS, COMMERCIAL_CATEGORIES, LAND_CATEGORIES, LOCATIONS, PROPERTY_TYPES } from "../data/site.js";
import { IMAGE_TYPES, MAX_IMAGES, checkImageFile, validateListing } from "../utils/listingValidation.js";
import { SelectField } from "./FormFields.jsx";
import PropertyImage from "./PropertyImage.jsx";

function Section({ title, hint, children }) {
  return (
    <fieldset className="border-t border-sand-200 pt-8 first:border-t-0 first:pt-0">
      <legend className="font-display text-xl font-light text-ink-900">{title}</legend>
      {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, error, hint, wide, children }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="field-label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

const input = (props) => <input className="field" {...props} />;

// Used for both "list a property" and "edit a listing".
// status: undefined for a new listing, otherwise the listing's current review status.
export default function PropertyForm({ initial, existingImages = [], status, busy, onSubmit }) {
  const [v, setV] = useState(initial);
  const [files, setFiles] = useState([]); // { key, file, preview }
  const [removedIds, setRemovedIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [fileNotes, setFileNotes] = useState([]);
  const filesRef = useRef([]);
  const summaryRef = useRef(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const kept = existingImages.filter((i) => !removedIds.includes(i.id));
  const imageCount = kept.length + files.length;

  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));
  const setType = (e) => {
    const propertyType = e.target.value;
    setV((p) => ({
      ...p, propertyType, category: "",
      bedrooms: ["house", "apartment"].includes(propertyType) ? p.bedrooms : "",
      bathrooms: propertyType === "land" ? "" : p.bathrooms,
      priceUnit: propertyType === "land" ? p.priceUnit : "total",
    }));
  };
  const toggleAmenity = (a) => setV((p) => ({ ...p, amenities: p.amenities.includes(a) ? p.amenities.filter((x) => x !== a) : [...p.amenities, a] }));

  const addFiles = (e) => {
    const chosen = [...e.target.files];
    e.target.value = "";
    const notes = [];
    const accepted = [];
    for (const file of chosen) {
      const problem = checkImageFile(file);
      if (problem) notes.push(problem);
      else if (kept.length + files.length + accepted.length >= MAX_IMAGES) notes.push(`${file.name}: you can add up to ${MAX_IMAGES} photos.`);
      else accepted.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    setFileNotes(notes);
    setFiles((prev) => [...prev, ...accepted]);
  };
  const removeNew = (key) => setFiles((prev) => {
    const gone = prev.find((f) => f.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    return prev.filter((f) => f.key !== key);
  });

  const handle = (submit) => {
    const found = validateListing(v, { submit, imageCount });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    onSubmit({
      values: v,
      newFiles: files.map((f) => f.file),
      removed: existingImages.filter((i) => removedIds.includes(i.id)),
      keptPositions: kept.map((i) => i.position),
      submit,
    });
  };

  const isRent = v.listingType === "rent";
  const showRooms = ["house", "apartment"].includes(v.propertyType);
  const showBaths = v.propertyType !== "land";
  const showLand = ["house", "land", "commercial"].includes(v.propertyType);
  const showRoad = ["land", "commercial"].includes(v.propertyType);
  const categories = v.propertyType === "commercial" ? COMMERCIAL_CATEGORIES : v.propertyType === "land" ? LAND_CATEGORIES : null;
  const draftFlow = !status || ["draft", "rejected"].includes(status);

  return (
    <form onSubmit={(e) => { e.preventDefault(); handle(true); }} noValidate className="space-y-10">
      {Object.keys(errors).length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Please fix the highlighted fields and try again.
        </div>
      )}

      <Section title="The basics">
        <Field label="Listing title" error={errors.title} wide hint="For example: Modern 3-bedroom home with garden">{input({ value: v.title, onChange: set("title"), maxLength: 120 })}</Field>
        <div>
          <span className="field-label">Sale or rent</span>
          <div role="radiogroup" aria-label="Sale or rent" className="grid grid-cols-2 gap-2">
            {[["sale", "For sale"], ["rent", "For rent"]].map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={v.listingType === value}
                onClick={() => setV((p) => ({ ...p, listingType: value, priceUnit: "total" }))}
                className={`rounded border px-4 py-2.5 text-sm font-medium transition-colors ${v.listingType === value ? "border-ink-900 bg-ink-900 text-sand-50" : "border-sand-300 bg-white text-ink-700 hover:border-ink-500"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <SelectField label="Property type" value={v.propertyType} onChange={(val) => setType({ target: { value: val } })} options={PROPERTY_TYPES} />
        {categories && (
          <SelectField label={v.propertyType === "land" ? "Land use" : "Category"} value={v.category} onChange={(val) => setV((p) => ({ ...p, category: val }))} options={categories} placeholder="Choose one" />
        )}
      </Section>

      <Section title="Price">
        <Field label={isRent ? "Monthly rent (Rs.)" : v.priceUnit === "aana" ? "Price per aana (Rs.)" : "Price (Rs.)"} error={errors.price}>
          {input({ type: "number", inputMode: "numeric", min: "0", step: "1000", value: v.price, onChange: set("price") })}
        </Field>
        {!isRent && v.propertyType === "land" ? (
          <SelectField label="Price is" value={v.priceUnit} onChange={(val) => setV((p) => ({ ...p, priceUnit: val }))} options={[{ value: "total", label: "The total price" }, { value: "aana", label: "Per aana" }]} />
        ) : (
          <p className="self-end pb-2 text-sm text-ink-500">{isRent ? "Charged per month." : "Enter the total asking price."}</p>
        )}
      </Section>

      <Section title="Location">
        <SelectField label="Area" value={v.location} onChange={(val) => setV((p) => ({ ...p, location: val }))} options={[...LOCATIONS, { value: "other", label: "Other area" }]} placeholder="Choose an area" />
        {errors.location && <p role="alert" className="-mt-3 text-xs text-red-700 sm:col-span-2">{errors.location}</p>}
        {v.location === "other" && (
          <>
            <Field label="Area name" error={errors.otherLocation}>{input({ value: v.otherLocation, onChange: set("otherLocation") })}</Field>
            <Field label="City" error={errors.otherCity}>{input({ value: v.otherCity, onChange: set("otherCity") })}</Field>
          </>
        )}
      </Section>

      <Section title="Property details">
        {showRooms && <Field label="Bedrooms" error={errors.bedrooms}>{input({ type: "number", min: "0", max: "50", value: v.bedrooms, onChange: set("bedrooms") })}</Field>}
        {showBaths && <Field label="Bathrooms" error={errors.bathrooms}>{input({ type: "number", min: "0", max: "50", value: v.bathrooms, onChange: set("bathrooms") })}</Field>}
        <Field label={v.propertyType === "land" ? "Plot area (sq ft)" : "Built-up area (sq ft)"} error={errors.areaSqft} hint={v.propertyType === "land" ? "Optional if you enter the land area in aana" : undefined}>
          {input({ type: "number", min: "0", value: v.areaSqft, onChange: set("areaSqft") })}
        </Field>
        {showLand && <Field label="Land area (aana)" error={errors.landArea}>{input({ type: "number", min: "0", step: "0.25", value: v.landArea, onChange: set("landArea") })}</Field>}
        {showRoad && <Field label="Road access" wide hint="For example: 20 ft blacktopped road">{input({ value: v.roadAccess, onChange: set("roadAccess"), maxLength: 120 })}</Field>}
        <Field label="Description" error={errors.description} wide hint={`${v.description.length}/4000. At least 30 characters to submit for review.`}>
          <textarea className="field resize-y" rows={6} maxLength={4000} value={v.description} onChange={set("description")} />
        </Field>
      </Section>

      <Section title="Amenities">
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
          {AMENITY_OPTIONS.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-3 text-sm text-ink-700">
              <input type="checkbox" checked={v.amenities.includes(a)} onChange={() => toggleAmenity(a)} className="h-4 w-4 rounded border-sand-400 accent-ink-900" />
              {a}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Photos" hint={`Add up to ${MAX_IMAGES} photos (JPEG, PNG or WebP, 5 MB each). The first photo is the cover image.`}>
        <div className="sm:col-span-2">
          <label className="btn-outline cursor-pointer">
            Choose photos
            <input type="file" multiple accept={IMAGE_TYPES.join(",")} onChange={addFiles} className="sr-only" />
          </label>
          <span className="ml-4 text-sm text-ink-500">{imageCount} of {MAX_IMAGES} added</span>
          {errors.images && <p role="alert" className="mt-2 text-xs text-red-700">{errors.images}</p>}
          {fileNotes.length > 0 && <ul className="mt-2 space-y-1 text-xs text-red-700">{fileNotes.map((n) => <li key={n}>{n}</li>)}</ul>}
          {imageCount > 0 && (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kept.map((i) => (
                <li key={i.id} className="relative aspect-[4/3] overflow-hidden rounded bg-sand-200">
                  <PropertyImage src={i.url} alt="Listing photo" width={400} />
                  <button type="button" onClick={() => setRemovedIds((r) => [...r, i.id])} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink-900"><X className="h-4 w-4" /></button>
                </li>
              ))}
              {files.map((f) => (
                <li key={f.key} className="relative aspect-[4/3] overflow-hidden rounded bg-sand-200">
                  <img src={f.preview} alt="New photo" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeNew(f.key)} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink-900"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Contact details" hint="Shown to visitors on your published listing.">
        <Field label="Contact name" error={errors.contactName}>{input({ value: v.contactName, onChange: set("contactName"), autoComplete: "name" })}</Field>
        <Field label="Phone" error={errors.contactPhone}>{input({ type: "tel", value: v.contactPhone, onChange: set("contactPhone"), autoComplete: "tel" })}</Field>
        <Field label="Email" error={errors.contactEmail}>{input({ type: "email", value: v.contactEmail, onChange: set("contactEmail"), autoComplete: "email" })}</Field>
      </Section>

      <div className="flex flex-col gap-3 border-t border-sand-200 pt-8 sm:flex-row">
        {draftFlow ? (
          <>
            <button type="submit" disabled={busy} className="btn-primary sm:min-w-48">{busy ? "Saving…" : "Submit for review"}</button>
            <button type="button" disabled={busy} onClick={() => handle(false)} className="btn-outline">{status === "rejected" ? "Save changes" : "Save draft"}</button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => handle(status !== "archived")} className="btn-primary sm:min-w-48">{busy ? "Saving…" : "Save changes"}</button>
        )}
      </div>
      {status === "published" && <p className="text-sm text-ink-500">Saving changes to a published listing sends it back for review. It stays hidden from visitors until a reviewer approves it again.</p>}
      {!status && <p className="text-sm text-ink-500">Submitted listings are reviewed before they appear on EstateHub. Drafts are visible only to you.</p>}
    </form>
  );
}
