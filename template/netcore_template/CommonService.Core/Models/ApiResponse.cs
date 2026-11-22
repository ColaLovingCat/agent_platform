namespace CommonService.Core.Models
{
    public class ApiResponse<T>
    {
        public bool Status { get; set; } = true;
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }

        public static ApiResponse<T> Ok(T data, string message = "")
        {
            return new ApiResponse<T> { Status = true, Data = data, Message = message };
        }

        public static ApiResponse<T> Fail(string message = "", T? data = default)
        {
            return new ApiResponse<T> { Status = false, Data = data, Message = message };
        }
    }

    public static class ResultStatus
    {
        /// <summary>
        /// 全局 “成功” 标识
        /// </summary>
        public const string OK = "OK";

        /// <summary>
        /// 全局 “失败” 标识（可选）
        /// </summary>
        public const string FAIL = "FAIL";
    }
}
