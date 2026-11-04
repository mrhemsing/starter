import { HeatCheckPage, generateHeatCheckMetadata } from "@/app/form/page";
export const revalidate = 900;
type PageProps = Pick<Parameters<typeof HeatCheckPage>[0], "searchParams">;
export default function Page(props: PageProps) { return HeatCheckPage(props); }
export function generateMetadata(props: PageProps) { return generateHeatCheckMetadata(props); }
