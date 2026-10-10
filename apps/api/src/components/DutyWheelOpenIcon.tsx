import { DUTY_WHEEL_ICON_PATH } from "@/lib/dutyWheelSvg";

type Props = {
  className?: string;
};

/** Lille hjul-ikon til knapper der åbner lodtræknings-modal (samme SVG som modal-dekor). */
export function DutyWheelOpenIcon({ className = "h-5 w-5 shrink-0" }: Props) {
  return (
    <svg
      viewBox="0 0 2836 2836"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path fillRule="evenodd" d={DUTY_WHEEL_ICON_PATH} />
    </svg>
  );
}
