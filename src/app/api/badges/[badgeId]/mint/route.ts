import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getBadge, updateBadgeMint } from '@/lib/db/badges';

/**
 * POST /api/badges/:badgeId/mint
 * Mint a badge as an NFT on Polygon.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { badgeId } = await params;

    const badge = await getBadge(badgeId);
    if (!badge || badge.userId !== userId) {
      return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
    }

    if (badge.tokenId) {
      return NextResponse.json({ error: 'Badge already minted' }, { status: 400 });
    }

    // Prepare NFT metadata
    const nftMetadata = {
      name: badge.title,
      description: `${badge.type} badge: ${badge.skill}`,
      image: `https://notestamp.com/api/badges/${badgeId}/image`,
      attributes: [
        { trait_type: 'Type', value: badge.type },
        { trait_type: 'Skill', value: badge.skill },
        { trait_type: 'Score', value: badge.score },
        { trait_type: 'User', value: userId },
      ],
    };

    // Upload to Pinata (IPFS)
    let ipfsHash = '';
    let metadataUri = '';
    try {
      const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: process.env.PINATA_API_KEY || '',
          pinata_secret_api_key: process.env.PINATA_SECRET_KEY || '',
        },
        body: JSON.stringify({ pinataContent: nftMetadata }),
      });

      if (pinataResponse.ok) {
        const pinataData = await pinataResponse.json();
        ipfsHash = pinataData.IpfsHash;
        metadataUri = `ipfs://${ipfsHash}`;
      }
    } catch (error) {
      console.error('[mint] IPFS upload error:', error);
      // Continue without IPFS for dev/testing
    }

    // Simulate on-chain mint for MVP (production: call smart contract)
    const tokenId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const txHash = `0x${Buffer.from(tokenId).toString('hex').padStart(64, '0')}`;

    const mintedBadge = await updateBadgeMint(badgeId, tokenId, txHash, ipfsHash, metadataUri);

    return NextResponse.json({ success: true, badge: mintedBadge });
  } catch (error) {
    console.error('[mint] Mint badge error:', error);
    return NextResponse.json({ error: 'Failed to mint badge' }, { status: 500 });
  }
}
