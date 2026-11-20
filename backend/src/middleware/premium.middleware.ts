import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { User, IUser } from '../models/User';

/**
 * Entitlement lives on the User document and is resolved here, server-side.
 * The client's `isPremium` is a display hint only — it must never be the thing
 * that decides whether a paid feature runs.
 */
export const isEntitled = (user: Pick<IUser, 'plan' | 'premiumUntil'> | null): boolean => {
  if (!user || user.plan !== 'premium') return false;
  if (!user.premiumUntil) return true; // non-expiring grant
  return user.premiumUntil.getTime() > Date.now();
};

export interface PremiumRequest extends AuthRequest {
  isPremium?: boolean;
}

/**
 * Resolves entitlement onto the request without blocking. Use on routes that
 * serve both tiers but need to degrade behaviour for free users.
 */
export const attachEntitlement = async (req: PremiumRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('plan premiumUntil').lean<Pick<IUser, 'plan' | 'premiumUntil'>>();
    req.isPremium = isEntitled(user);
  } catch {
    req.isPremium = false;
  }
  next();
};

/** Hard gate: rejects the request outright unless the user is entitled. */
export const requirePremium = async (req: PremiumRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('plan premiumUntil').lean<Pick<IUser, 'plan' | 'premiumUntil'>>();
    if (!isEntitled(user)) {
      res.status(402).json({
        message: 'This feature requires a premium subscription.',
        code: 'PREMIUM_REQUIRED',
      });
      return;
    }
    req.isPremium = true;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Could not verify subscription status' });
  }
};
