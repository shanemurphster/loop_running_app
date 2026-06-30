import clsx from "clsx";
import type { User } from "@/lib/types";

export function Avatar({
  user,
  size = 36,
  className,
}: {
  user: Pick<User, "name" | "avatarColor" | "avatarUrl">;
  size?: number;
  className?: string;
}) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        className={clsx("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={clsx(
        "grid place-items-center rounded-full font-bold text-black",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: user.avatarColor,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
