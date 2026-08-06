"use client";

import { Star, MessageSquare } from "lucide-react";

function TogglePair({
  label,
  positiveLabel,
  negativeLabel,
  value,
  onChange,
  positiveValue,
  negativeValue,
}: {
  label: string;
  positiveLabel: string;
  negativeLabel: string;
  value: string | null;
  onChange: (v: string | null) => void;
  positiveValue: string;
  negativeValue: string;
}) {
  return (
    <div>
      <p className="text-xs text-navy-400 mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`btn-ghost !py-2 text-sm ${value === positiveValue ? "!bg-jade-500 !text-white !border-jade-500" : ""}`}
          onClick={() => onChange(value === positiveValue ? null : positiveValue)}
        >
          {positiveLabel}
        </button>
        <button
          type="button"
          className={`btn-ghost !py-2 text-sm ${value === negativeValue ? "!bg-coral-500 !text-white !border-coral-500" : ""}`}
          onClick={() => onChange(value === negativeValue ? null : negativeValue)}
        >
          {negativeLabel}
        </button>
      </div>
    </div>
  );
}

export function DriverRatingForm({
  stars,
  onStarsChange,
  tagPoliteness,
  onTagPolitenessChange,
  tagPunctuality,
  onTagPunctualityChange,
  tagCleanliness,
  onTagCleanlinessChange,
  showOtherComment,
  onShowOtherCommentChange,
  otherComment,
  onOtherCommentChange,
  onSubmit,
  submitting,
}: {
  stars: number;
  onStarsChange: (s: number) => void;
  tagPoliteness: "polite" | "rude" | null;
  onTagPolitenessChange: (v: "polite" | "rude" | null) => void;
  tagPunctuality: "on_time" | "very_late" | null;
  onTagPunctualityChange: (v: "on_time" | "very_late" | null) => void;
  tagCleanliness: "clean" | "dirty" | null;
  onTagCleanlinessChange: (v: "clean" | "dirty" | null) => void;
  showOtherComment: boolean;
  onShowOtherCommentChange: (v: boolean) => void;
  otherComment: string;
  onOtherCommentChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4 text-left">
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onStarsChange(s)}>
            <Star className={`w-7 h-7 ${s <= stars ? "fill-gold-400 text-gold-400" : "text-navy-200"}`} />
          </button>
        ))}
      </div>

      <p className="label text-center">Anything to share? (optional)</p>

      <TogglePair
        label="Manner"
        positiveLabel="Polite"
        negativeLabel="Rude"
        value={tagPoliteness}
        onChange={(v) => onTagPolitenessChange(v as any)}
        positiveValue="polite"
        negativeValue="rude"
      />
      <TogglePair
        label="Timing"
        positiveLabel="On time"
        negativeLabel="Very late"
        value={tagPunctuality}
        onChange={(v) => onTagPunctualityChange(v as any)}
        positiveValue="on_time"
        negativeValue="very_late"
      />
      <TogglePair
        label="Vehicle"
        positiveLabel="Car clean"
        negativeLabel="Car dirty"
        value={tagCleanliness}
        onChange={(v) => onTagCleanlinessChange(v as any)}
        positiveValue="clean"
        negativeValue="dirty"
      />

      {!showOtherComment ? (
        <button type="button" className="btn-ghost w-full !py-2 text-sm" onClick={() => onShowOtherCommentChange(true)}>
          <MessageSquare className="w-4 h-4" /> Other comment for admin
        </button>
      ) : (
        <div>
          <p className="text-xs text-navy-400 mb-1.5">
            This goes to Vuma's admin team, not the driver directly.
          </p>
          <textarea
            className="input text-sm"
            rows={3}
            placeholder="What happened?"
            value={otherComment}
            onChange={(e) => onOtherCommentChange(e.target.value)}
          />
        </div>
      )}

      <button className="btn-primary w-full" onClick={onSubmit} disabled={submitting}>
        Submit rating
      </button>
    </div>
  );
}
