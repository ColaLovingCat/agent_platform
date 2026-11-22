
namespace CommonService.Core.Models
{
    public class PagedResult<T>
    {

        public Pagination Pagination { get; set; }
        public IEnumerable<T> Items { get; set; } = new List<T>();
    }

    public class Pagination
    {
        public int PageIndex { get; set;}
        public int PageSize { get; set;}
        public int TotalCount { get; set; }
    }
}
