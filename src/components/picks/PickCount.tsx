interface PickCountProps {
  count: number;
  limit: number;
}

export function PickCount({ count, limit }: PickCountProps) {
  return (
    <p aria-live="polite" aria-atomic="true" className="card">
      <strong>
        {count} / {limit} selected
      </strong>
    </p>
  );
}
