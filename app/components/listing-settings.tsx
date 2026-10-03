"use client";
import { useEffect, useState, type FormEvent } from "react";
import { readJson } from "@/lib/http";
export function ListingSettings({ propertyId }: { propertyId: string }) {
  const [amenities, setAmenities] = useState(""),
    [pets, setPets] = useState("ask"),
    [parking, setParking] = useState("ask"),
    [publication, setPublication] = useState("published"),
    [policies, setPolicies] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/listing-settings?propertyId=" + propertyId)
      .then(
        readJson<{
          settings: {
            amenities: string[];
            pet_policy: string;
            parking: string;
            publication: string;
            policies: string;
          };
        }>,
      )
      .then(({ settings: s }) => {
        setAmenities(s.amenities.join(", "));
        setPets(s.pet_policy);
        setParking(s.parking);
        setPublication(s.publication);
        setPolicies(s.policies);
      })
      .catch((e) => setNotice(e.message));
  }, [propertyId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/listing-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          amenities: amenities.split(","),
          pet_policy: pets,
          parking,
          publication,
          policies,
        }),
      }).then(readJson);
      setNotice(
        "Listing settings saved. Draft properties remain hidden until published.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="card review-panel">
      <summary>Listing, amenities & policies</summary>
      <form className="compact-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Amenities, separated by commas
            <input
              value={amenities}
              placeholder="gym, garden, security"
              onChange={(e) => setAmenities(e.target.value)}
            />
          </label>
          <label>
            Pet policy
            <select value={pets} onChange={(e) => setPets(e.target.value)}>
              <option value="ask">Ask the property team</option>
              <option value="allowed">Pets allowed</option>
              <option value="not_allowed">No pets</option>
            </select>
          </label>
          <label>
            Parking
            <select
              value={parking}
              onChange={(e) => setParking(e.target.value)}
            >
              <option value="ask">Ask the property team</option>
              <option value="available">Available</option>
              <option value="none">Not available</option>
            </select>
          </label>
          <label>
            Marketplace availability
            <select
              value={publication}
              onChange={(e) => setPublication(e.target.value)}
            >
              <option value="published">Visible when published</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <label>
          Policies
          <textarea
            value={policies}
            onChange={(e) => setPolicies(e.target.value)}
          />
        </label>
        <button className="button button-dark" disabled={busy}>
          Save listing settings
        </button>
        <p role="status">{notice}</p>
      </form>
    </details>
  );
}
