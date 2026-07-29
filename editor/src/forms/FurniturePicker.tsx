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
  // Changing the Category must also change the PIECE — otherwise the dropdown
  // shows a new category while the model keeps the old item. Snap to the first
  // piece of the newly-chosen category (the sync above then keeps `cat` aligned).
  const changeCategory = (c: string) => {
    setCat(c);
    const first = FURNITURE_CATALOG.find((a) => a.category === c);
    if (first && first.id !== value) onPick(first.id);
  };
  return (
    <>
      <SelectField
        label="Category"
        value={cat}
        onChange={changeCategory}
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
