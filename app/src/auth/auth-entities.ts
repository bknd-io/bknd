import { text } from "data/prototype";

export const usersFields = {
   email: text().required(),
   strategy: text({
      fillable: ["create"],
      hidden: ["update", "form"],
   }).required(),
   strategy_value: text({
      fillable: ["create"],
      hidden: ["read", "table", "update", "form"],
   }).required(),
   role: text(),
};
