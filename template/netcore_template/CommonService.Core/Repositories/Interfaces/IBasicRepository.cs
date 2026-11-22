namespace CommonService.Core.Repositories.Interfaces
{
    public interface IBasicRepository<T> where T : class
    {
        Task<List<T>> GetAllAsync();
        Task<T?> GetByIDAsync(Guid id);
        Task AddAsync(T entity);
        Task UpdateAsync(T entity);
        Task DeleteAsync(Guid id);
    }
}
