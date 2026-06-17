interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className = 'h-4 w-24' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-lg bg-surface-subtle ${className}`} aria-hidden="true" />
}
