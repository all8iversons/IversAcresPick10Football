interface PickCardProps {
  teamId: string;
  teamName: string;
  selected: boolean;
  disabled: boolean;
  onToggle(teamId: string): void;
}

export function PickCard({
  teamId,
  teamName,
  selected,
  disabled,
  onToggle,
}: PickCardProps) {
  return (
    <button
      aria-pressed={selected}
      className={`pick-card${selected ? " pick-card-selected" : ""}`}
      disabled={disabled}
      onClick={() => onToggle(teamId)}
      type="button"
    >
      <span>{teamName}</span>
      <span aria-hidden="true">{selected ? "Selected" : "Pick to win"}</span>
    </button>
  );
}
