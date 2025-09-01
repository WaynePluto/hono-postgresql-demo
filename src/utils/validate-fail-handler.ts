import { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const validateFailHandler = (result: any, c: Context<any, string, {}>) => {
  if (!result.success) {
    try {
      const errMessages: Array<{ message: string; path: string[] }> = JSON.parse(result.error.message);
      const msg = errMessages.map(el => `参数${el.path.join(",")}错误: ${el.message}`).join("; ");
      return c.json({ code: 400, msg: msg, info: errMessages });
    } catch (error) {
      console.log("🚀 ~ error:", error);
      throw new HTTPException(500, { message: "生成参数校验信息失败" });
    }
  }
};
