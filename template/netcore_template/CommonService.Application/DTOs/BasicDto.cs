using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CommonService.Application.DTOs
{
    public class IDDto
    {
        public string ID { get; set; }
    }

    public class GUIDDto
    {
        public Guid ID { get; set; }
    }

    public class ExternalRequestDto
    {
        public string Url { get; set; } = string.Empty;
        public string Method { get; set; } = "POST";
        public object? Body { get; set; }
    }
}
