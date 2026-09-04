type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  hasXai: boolean;
};

/** Next to Enhance. Hidden when Enhance is unavailable (no xAI key). Default OFF. */
export default function CreativeEnhanceToggle({
  checked,
  onChange,
  hasXai,
}: Props) {
  if (!hasXai) return null;
  return (
    <div className="creative-enhance">
      <label className="param">
        <span>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />{" "}
          Creative Enhance
        </span>
      </label>
      <p className="hint">Creative = more detail. Off = tight rewrite for the model.</p>
    </div>
  );
}
