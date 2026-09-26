import BracketPage from "@/components/BracketPage";

export default async function BracketRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BracketPage id={id} />;
}
