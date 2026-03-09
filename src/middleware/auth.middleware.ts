import jwt  from "jsonwebtoken";
import "dotenv/config"
export const authMiddleware = (req: any, res: any, next: any) => {

    const token = req.cookies.token;
    if(!token){
        return res.status(500).json({message: "no token provided "});   
    }
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        return res.status(200).json(decoded);
    }catch(err){
        return res.status(500).json("given token did not match");
    }
}