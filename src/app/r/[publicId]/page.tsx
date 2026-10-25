import { Suspense } from "react";
import ResultView from "@/components/ResultView";

export default function ResultPage({ params }: PageProps<"/r/[publicId]">) {
  return (
    <Suspense>
      <Result params={params} />
    </Suspense>
  );
}

async function Result({ params }: { params: PageProps<"/r/[publicId]">["params"] }) {
  const { publicId } = await params;
  return <ResultView publicId={publicId} />;
}
