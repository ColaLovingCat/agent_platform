using System.Linq.Expressions;
using System.Reflection;

namespace CommonService.Core.Models
{
    public static class QueryableExtensions
    {
        public static IQueryable<T> ApplyFilters<T>(this IQueryable<T> query, Dictionary<string, string>? filters)
        {
            if (filters == null || filters.Count == 0)
                return query;

            var parameter = Expression.Parameter(typeof(T), "x");
            Expression? finalExpression = null;

            foreach (var kvp in filters)
            {
                var propertyName = kvp.Key;
                var filterValue = kvp.Value;
                var property = Expression.PropertyOrField(parameter, propertyName);

                var expressions = new List<Expression>();

                foreach (var condition in filterValue.Split(',', StringSplitOptions.RemoveEmptyEntries))
                {
                    var parts = condition.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length < 2) continue;
                    var op = parts[0];
                    var val = parts[1];
                    var constant = Expression.Constant(Convert.ChangeType(val, property.Type));

                    Expression? expr = op switch
                    {
                        "eq" => Expression.Equal(property, constant),
                        "ne" => Expression.NotEqual(property, constant),
                        "gt" => Expression.GreaterThan(property, constant),
                        "lt" => Expression.LessThan(property, constant),
                        "gte" => Expression.GreaterThanOrEqual(property, constant),
                        "lte" => Expression.LessThanOrEqual(property, constant),
                        "match" => Expression.Call(property,
                            typeof(string).GetMethod("Contains", new[] { typeof(string) })!,
                            Expression.Constant(val)),
                        _ => null
                    };

                    if (expr != null)
                        expressions.Add(expr);
                }

                if (expressions.Count == 0)
                    continue;

                // 同一个字段的多个条件用 AND
                var fieldExpression = expressions.Aggregate(Expression.AndAlso);

                finalExpression = finalExpression == null
                    ? fieldExpression
                    : Expression.AndAlso(finalExpression, fieldExpression);
            }

            if (finalExpression == null)
                return query;

            var lambda = Expression.Lambda<Func<T, bool>>(finalExpression, parameter);
            return query.Where(lambda);
        }

        public static IQueryable<T> ApplySorting<T>(this IQueryable<T> query, string? sort)
        {
            if (string.IsNullOrWhiteSpace(sort))
                return query;

            var sortFields = sort.Split(',', StringSplitOptions.RemoveEmptyEntries);
            bool first = true;

            foreach (var sortField in sortFields)
            {
                var parts = sortField.Split(':', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) continue;

                var propertyName = parts[0];
                var direction = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase)
                    ? "OrderByDescending"
                    : "OrderBy";

                // 获取属性
                var property = typeof(T).GetProperty(propertyName,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);
                if (property == null)
                    continue; // 跳过无效字段

                // 构造表达式 x => x.Property
                var parameter = Expression.Parameter(typeof(T), "x");
                var propertyAccess = Expression.Property(parameter, property);
                var orderByExp = Expression.Lambda(propertyAccess, parameter);

                var methodName = first
                    ? direction
                    : (direction == "OrderBy" ? "ThenBy" : "ThenByDescending");

                var resultExp = Expression.Call(
                    typeof(Queryable),
                    methodName,
                    new Type[] { typeof(T), property.PropertyType },
                    query.Expression,
                    Expression.Quote(orderByExp));

                query = query.Provider.CreateQuery<T>(resultExp);
                first = false;
            }

            return query;
        }
    }
}
