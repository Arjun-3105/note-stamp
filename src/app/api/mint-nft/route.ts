import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const ABI = [
  {
    inputs: [
      { internalType: "address", name: "learner", type: "address" },
      { internalType: "string", name: "metadataURI", type: "string" },
    ],
    name: "mintSkillNFT",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function buildMetadataURI(metadata: object): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  const key = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET_KEY;

  if (jwt || (key && secret)) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    } else {
      headers["pinata_api_key"] = key!;
      headers["pinata_secret_api_key"] = secret!;
    }

    try {
      const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers,
        body: JSON.stringify({ pinataContent: metadata }),
      });
      if (res.ok) {
        const data = (await res.json()) as { IpfsHash: string };
        return `ipfs://${data.IpfsHash}`;
      }
      console.warn("[mint-nft] Pinata failed, falling back to data URI:", res.status);
    } catch {
      console.warn("[mint-nft] Pinata unreachable, falling back to data URI");
    }
  }

  const b64 = Buffer.from(JSON.stringify(metadata)).toString("base64");
  return `data:application/json;base64,${b64}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, topic, score, resourceUrl } = body as {
      walletAddress?: string;
      topic?: string;
      score?: number;
      resourceUrl?: string;
    };

    if (!walletAddress || !topic || typeof score !== "number") {
      return NextResponse.json(
        { error: "walletAddress, topic, and score are required" },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.RPC_URL || process.env.POLYGON_RPC_URL;
    const rawKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    if (!rpcUrl || !rawKey || !contractAddress) {
      const missing = [
        !rpcUrl && "RPC_URL",
        !rawKey && "PRIVATE_KEY",
        !contractAddress && "NEXT_PUBLIC_CONTRACT_ADDRESS",
      ].filter(Boolean).join(", ");
      return NextResponse.json({ error: `Missing env vars: ${missing}` }, { status: 500 });
    }

    const metadata = {
      name: `LearnLoop: ${topic}`,
      description: `Proof of Learning — passed ${topic} with score ${score}/100`,
      attributes: [
        { trait_type: "Topic", value: topic },
        { trait_type: "Score", value: score },
        { trait_type: "Resource", value: resourceUrl || "" },
        { trait_type: "Date", value: new Date().toISOString() },
      ],
    };

    const metadataURI = await buildMetadataURI(metadata);

    const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, ABI, signer);

    const tx = await contract.mintSkillNFT(walletAddress, metadataURI);
    await tx.wait();

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      metadataURI,
      explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mint-nft]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

