import { firstValueFrom, of } from "rxjs";

import { getById, getByIds } from "./rxjs-operators";

describe("custom rxjs operators", () => {
  describe("getById", () => {
    it("returns an object with a matching id", async () => {
      const input = [
        {
          id: 1,
          data: "one",
        },
        {
          id: 2,
          data: "two",
        },
        {
          id: 3,
          data: "three",
        },
      ];

      const output = await firstValueFrom(getById(2)(of(input)));

      expect(output).toEqual([{ id: 1, data: "one" }]);
    });
  });

  describe("getByIds", () => {
    it("returns an array of objects with matching ids", async () => {
      const input = [
        {
          id: 1,
          data: "one",
        },
        {
          id: 2,
          data: "two",
        },
        {
          id: 3,
          data: "three",
        },
        {
          id: 4,
          data: "four",
        },
      ];

      const output = await firstValueFrom(getByIds([2, 3])(of(input)));

      expect(output).toEqual([
        { id: 2, data: "two" },
        { id: 3, data: "three" },
      ]);
    });
  });
});
