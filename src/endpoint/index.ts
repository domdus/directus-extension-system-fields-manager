import type { Request, Response, NextFunction, Router } from 'express';
import { checkForUpdates } from './update-check';

function requireAdmin(req: Request, res: Response): boolean {
	const accountability = (req as any).accountability as
		| { admin?: boolean; admin_access?: boolean; role?: { admin_access?: boolean } | string | null }
		| null
		| undefined;
	if (!accountability) {
		res.status(403).json({ errors: [{ message: 'Admin access required' }] });
		return false;
	}
	const isAdmin =
		accountability.admin === true ||
		accountability.admin_access === true ||
		(typeof accountability.role === 'object' && accountability.role?.admin_access === true);
	if (!isAdmin) {
		res.status(403).json({ errors: [{ message: 'Admin access required' }] });
		return false;
	}
	return true;
}

export default {
	id: 'system-fields-manager',
	handler: (router: Router) => {
		router.get('/update-check', async (req: Request, res: Response, next: NextFunction) => {
			try {
				if (!requireAdmin(req, res)) return;
				const force = String(req.query.force || '') === '1';
				const data = await checkForUpdates(force);
				res.json({ data });
			} catch (error) {
				next(error);
			}
		});
	},
};
