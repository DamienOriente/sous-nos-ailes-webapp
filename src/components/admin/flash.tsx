import { Alert } from "@/components/ui/alert";

type SearchParams = Record<string, string | string[] | undefined>;

/** One-shot feedback carried by `?notice=` / `?error=` after a redirecting Server Action. */
export function Flash({ searchParams }: { searchParams: SearchParams }) {
  const notice = typeof searchParams.notice === "string" ? searchParams.notice : null;
  const error = typeof searchParams.error === "string" ? searchParams.error : null;
  if (!notice && !error) return null;
  return (
    <div className="flex flex-col gap-3">
      {notice ? (
        <Alert kind="success" role="status">
          {notice}
        </Alert>
      ) : null}
      {error ? (
        <Alert kind="danger" role="alert">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
