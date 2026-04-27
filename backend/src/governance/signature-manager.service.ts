import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Keypair } from '@stellar/stellar-sdk';

export interface SubmitSignatureDto {
  proposalId: string;
  signerPublicKey: string; // Stellar Ed25519 public key (G…)
  signature: string;       // Base64-encoded Ed25519 signature over the proposal payload
}

export interface ProposalSummary {
  id: string;
  title: string;
  status: string;
  quorum: number;
  signaturesCollected: number;
  quorumReached: boolean;
}

/**
 * Manages off-chain Ed25519 signature collection for governance proposals.
 *
 * Flow:
 *  1. A proposal is created with a required quorum count and a payload (XDR).
 *  2. Participants POST their Ed25519 signature over the payload.
 *  3. Each signature is verified before storage.
 *  4. Once quorum is reached the proposal status advances to QUORUM_REACHED,
 *     at which point the bundled transaction can be submitted on-chain.
 */
@Injectable()
export class SignatureManagerService {
  private readonly logger = new Logger(SignatureManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit an Ed25519 signature for a governance proposal.
   * Verifies the signature cryptographically before persisting it.
   */
  async submitSignature(dto: SubmitSignatureDto): Promise<ProposalSummary> {
    const { proposalId, signerPublicKey, signature } = dto;

    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
      include: { signatures: true },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'OPEN') {
      throw new BadRequestException(
        `Proposal is not open for signatures (status: ${proposal.status})`,
      );
    }

    // Verify the Ed25519 signature over the proposal payload
    this.verifyEd25519Signature(signerPublicKey, proposal.payload, signature);

    // Persist (unique constraint prevents duplicate signatures per signer)
    try {
      await this.prisma.governanceSignature.create({
        data: { proposalId, signerKey: signerPublicKey, signature },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Signature from this key already recorded');
      }
      throw err;
    }

    const totalSignatures = proposal.signatures.length + 1;
    const quorumReached = totalSignatures >= proposal.quorum;

    if (quorumReached && proposal.status === 'OPEN') {
      await this.prisma.governanceProposal.update({
        where: { id: proposalId },
        data: { status: 'QUORUM_REACHED' },
      });
      this.logger.log(`Proposal ${proposalId} reached quorum (${totalSignatures}/${proposal.quorum})`);
    }

    return {
      id: proposal.id,
      title: proposal.title,
      status: quorumReached ? 'QUORUM_REACHED' : 'OPEN',
      quorum: proposal.quorum,
      signaturesCollected: totalSignatures,
      quorumReached,
    };
  }

  /**
   * Get the current signature status for a proposal.
   */
  async getProposalStatus(proposalId: string): Promise<ProposalSummary> {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
      include: { _count: { select: { signatures: true } } },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    const signaturesCollected = proposal._count.signatures;
    return {
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      quorum: proposal.quorum,
      signaturesCollected,
      quorumReached: signaturesCollected >= proposal.quorum,
    };
  }

  // ── private ────────────────────────────────────────────────────────────────

  /**
   * Verify an Ed25519 signature using the Stellar SDK Keypair.
   * Throws BadRequestException if the signature is invalid.
   */
  private verifyEd25519Signature(
    publicKey: string,
    payload: string,
    signatureBase64: string,
  ): void {
    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const payloadBuffer = Buffer.from(payload);
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');
      const valid = keypair.verify(payloadBuffer, signatureBuffer);
      if (!valid) {
        throw new BadRequestException('Invalid Ed25519 signature');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Signature verification failed: ${err.message}`);
    }
  }
}
