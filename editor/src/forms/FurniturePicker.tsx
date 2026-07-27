import { useState } from "react";
import { SelectField } from "./fields";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, furnitureSpec } from "../furniture/catalog";

// Two-step furniture picker: a Category filter narrows the Piece list. Keeps the
// category in sync with the selected piece (so switching objects, or picking a piece
// in another category, resets the filter sensibly).
export function FurniturePicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (id: string) => void;
}) {
  const pieceCat = furnitureSpec(value)?.category ?? FURNITURE_CATEGORIES[0];
  const [cat, setCat] = useState(pieceCat);
  const [seen, setSeen] = useState(value);
  // Adjust-during-render: when the selected piece changes (new object, or a pick that
  // lands in a different category), follow it.
  if (value !== seen) {
    setSeen(value);
    setCat(pieceCat);
  }
  const pieces = FURNITURE_CATALOG.filter((a) => a.category === cat);
  return (
    <>
      <SelectField
        label="Category"
        value={cat}
        onChange={setCat}
        options={FURNITURE_CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      <SelectField
        label="Piece"
        value={value}
        onChange={onPick}
        options={pieces.map((a) => ({ value: a.id, label: a.name }))}
      />
    </>
  );
}
