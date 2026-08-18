type Props = {
  onClose?: () => void;
};

export default function NodeClose({ onClose }: Props) {
  if (!onClose) return null;
  return (
    <button
      type="button"
      className="node-close nodrag nopan"
      aria-label="Close node"
      title="Close"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }}
    >
      ×
    </button>
  );
}
