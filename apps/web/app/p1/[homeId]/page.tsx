import { P1FloorplanEditor } from "../_components/P1FloorplanEditor.js";

type PageProps = {
  params: Promise<{ homeId: string }> | { homeId: string };
};

export default async function P1FloorplanPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <P1FloorplanEditor homeId={resolvedParams.homeId} />;
}
