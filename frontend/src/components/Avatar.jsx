import { avatarColor, initials } from '../utils/avatar'

export default function Avatar({ name, size = 32 }) {
  const { bg, fg } = avatarColor(name)
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: size * 0.4,
      }}
    >
      {initials(name)}
    </span>
  )
}
