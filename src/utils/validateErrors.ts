import { validationResult } from "express-validator";

const validateErrors = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(500).json({errors: errors.array()});
    }

    next();
}

export default validateErrors;