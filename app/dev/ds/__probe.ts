import { buildCard } from "@/lib/dashboard/build-models";
import { arFashionInput } from "@/lib/dashboard/fixtures";
console.log(JSON.stringify(buildCard(arFashionInput()).tiles.map((t) => [t.value, t.sub]), null, 1));
