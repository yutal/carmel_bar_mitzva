import HallScreen from "@/components/HallScreen";

export const metadata = { title: "מסך האולם" };

export default async function ScreenPage({ params }: PageProps<"/e/[slug]/screen">) {
  const { slug } = await params;
  return <HallScreen slug={slug} />;
}
