// Placeholder; replaced by the pm-08 page build.
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1 className="text-2xl font-semibold tracking-tight">Agent {id}</h1>;
}
