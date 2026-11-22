using Microsoft.AspNetCore.Mvc;
using CommonService.Core.Utils;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/aes")]
    public class AesController : ControllerBase
    {
        public class EncryptDto
        {
            public string Text { get; set; }
        }

        /// <summary>
        /// 加密文本
        /// </summary>
        [HttpPost("encrypt")]
        public IActionResult Encrypt([FromBody] EncryptDto request)
        {
            if (string.IsNullOrEmpty(request?.Text))
                return BadRequest("请输入要加密的文本");

            try
            {
                var encrypted = AesEncryptionHelper.Encrypt(request.Text);
                return Ok(new EncryptDto { Text = encrypted });
            }
            catch (Exception ex)
            {
                return BadRequest("加密失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 解密文本
        /// </summary>
        [ApiExplorerSettings(IgnoreApi = true)]
        [HttpPost("decrypt")]
        public IActionResult Decrypt([FromBody] EncryptDto request)
        {
            if (string.IsNullOrEmpty(request?.Text))
                return BadRequest("请输入要解密的文本");

            try
            {
                var decrypted = AesEncryptionHelper.Decrypt(request.Text);
                return Ok(new EncryptDto { Text = decrypted });
            }
            catch (Exception ex)
            {
                return BadRequest("解密失败：" + ex.Message);
            }
        }
    }
}
