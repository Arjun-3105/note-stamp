'use client';

export interface Badge {
  $id: string;
  userId: string;
  type: 'micro' | 'skill' | 'master';
  title: string;
  description: string;
  icon: string;
  evidence: any;
  tokenId?: string;
  txHash?: string;
  ipfsHash?: string;
  createdAt: string;
  mintedAt?: string;
}

export interface PassportViewProps {
  badges: Badge[];
  userId: string;
  onMintClick?: (badge: Badge) => void;
  loading?: boolean;
}

export function PassportView({ badges, userId, onMintClick, loading }: PassportViewProps) {
  const microBadges = badges.filter(b => b.type === 'micro');
  const skillBadges = badges.filter(b => b.type === 'skill');
  const masterBadges = badges.filter(b => b.type === 'master');

  return (
    <div className="space-y-12">
      {/* Micro Badges */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Micro Badges</h2>
        {microBadges.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-gray-600">
            <p>No micro badges earned yet</p>
            <p className="text-sm mt-2">Earn these by completing individual sources</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {microBadges.map(badge => (
              <BadgeCard
                key={badge.$id}
                badge={badge}
                onMintClick={() => onMintClick?.(badge)}
                isMinted={!!badge.tokenId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Skill Badges */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Skill Badges</h2>
        {skillBadges.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-gray-600">
            <p>No skill badges earned yet</p>
            <p className="text-sm mt-2">Earn these by mastering a complete workspace</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
            {skillBadges.map(badge => (
              <BadgeCard
                key={badge.$id}
                badge={badge}
                onMintClick={() => onMintClick?.(badge)}
                isMinted={!!badge.tokenId}
                size="lg"
              />
            ))}
          </div>
        )}
      </div>

      {/* Master Certificates */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Master Certificates</h2>
        {masterBadges.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-gray-600">
            <p>No master certificates earned yet</p>
            <p className="text-sm mt-2">Earn by completing your entire learning journey</p>
          </div>
        ) : (
          <div className="space-y-4">
            {masterBadges.map(badge => (
              <BadgeCard
                key={badge.$id}
                badge={badge}
                onMintClick={() => onMintClick?.(badge)}
                isMinted={!!badge.tokenId}
                size="xl"
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border border-blue-200">
        <h3 className="font-bold text-gray-900 mb-4">Your Progress</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{microBadges.length}</p>
            <p className="text-sm text-gray-600 mt-1">Micro Badges</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-600">{skillBadges.length}</p>
            <p className="text-sm text-gray-600 mt-1">Skill Badges</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{masterBadges.length}</p>
            <p className="text-sm text-gray-600 mt-1">Master Certificates</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface BadgeCardProps {
  badge: Badge;
  onMintClick?: () => void;
  isMinted?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function BadgeCard({
  badge,
  onMintClick,
  isMinted,
  size = 'md',
}: BadgeCardProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-12',
  };

  const iconSizes = {
    sm: 'text-4xl',
    md: 'text-6xl',
    lg: 'text-8xl',
    xl: 'text-9xl',
  };

  return (
    <div className={`rounded-lg border-2 border-gray-200 ${sizeClasses[size]} text-center hover:shadow-lg transition-shadow relative`}>
      {isMinted && (
        <div className="absolute top-2 right-2 bg-green-100 text-green-700 rounded-full p-1 text-xs font-bold">
          ✓ Minted
        </div>
      )}

      <div className={`${iconSizes[size]} mb-4`}>{badge.icon}</div>
      <h3 className="font-bold text-gray-900 text-sm md:text-base">{badge.title}</h3>
      <p className="text-xs md:text-sm text-gray-600 mt-2">{badge.description}</p>

      {size !== 'sm' && !isMinted && (
        <button
          onClick={onMintClick}
          className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs md:text-sm text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Mint as NFT
        </button>
      )}

      {isMinted && size !== 'sm' && (
        <div className="mt-4 text-xs text-green-600 font-medium">
          <p>Token ID: {badge.tokenId?.slice(0, 8)}...</p>
          {badge.ipfsHash && (
            <a
              href={`https://ipfs.io/ipfs/${badge.ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on IPFS
            </a>
          )}
        </div>
      )}
    </div>
  );
}

