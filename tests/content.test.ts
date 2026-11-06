import test from "node:test";
import assert from "node:assert/strict";
import { contentTexts, displayContent } from "../src/domain/content";
import { emptyData, houseSchema } from "../src/domain/schema";
test("translation inputs contain descriptive text and exclude identity, location and access data", () => {
  const house = {
    ...houseSchema.parse({
      nickname: "Casa da Ana",
      client_name: "Ana Silva",
      address: "123 Main Street",
      phone: "555-0100",
      checklist: ["Limpar cozinha"],
      notes: "Não usar água sanitária",
      pets: "Um gato",
    }),
    id: "house",
    business_id: "business",
    access_instructions: "never-send-private-code",
  };
  const data = {
    ...emptyData,
    houses: [house],
    photos: [
      {
        id: "p",
        house_id: "house",
        visit_id: null,
        path: "private/path.jpg",
        caption: "Vaso encontrado",
      },
    ],
  };
  const original = JSON.stringify(data);
  const inputs = contentTexts(data);
  assert.deepEqual(inputs, [
    "Limpar cozinha",
    "Um gato",
    "Não usar água sanitária",
    "Vaso encontrado",
  ]);
  for (const value of [
    house.client_name,
    house.address,
    house.phone,
    house.access_instructions,
    "private/path.jpg",
    house.nickname,
  ])
    assert.equal(inputs.includes(value), false);
  assert.equal(JSON.stringify(data), original);
});
test("translated checklists keep bullets and use original text when a translation is unavailable", () => {
  const translations = new Map([
    ["Limpar cozinha", "Clean the kitchen"],
    ["Não usar água sanitária", "Do not use bleach"],
  ]);
  assert.equal(
    displayContent("• Limpar cozinha\n• Não usar água sanitária", translations),
    "• Clean the kitchen\n• Do not use bleach",
  );
  assert.equal(
    displayContent("✓ Limpar cozinha", translations),
    "✓ Clean the kitchen",
  );
  assert.equal(
    displayContent("Untranslated original", translations),
    "Untranslated original",
  );
});
