/**
 * Search Analytics Tools
 */

import { SearchConsoleClient } from '../client/index.js';

interface QuerySearchAnalyticsArgs {
  site_url: string;
  start_date: string;
  end_date: string;
  dimensions?: string[];
  search_type?: string;
  data_state?: string;
  aggregation_type?: string;
  row_limit?: number;
  start_row?: number;
  dimension_filter_groups?: Array<{
    group_type?: string;
    filters: Array<{
      dimension: string;
      operator: string;
      expression: string;
    }>;
  }>;
}

export async function querySearchAnalytics(
  client: SearchConsoleClient,
  args: QuerySearchAnalyticsArgs
) {
  if (!args.site_url || !args.start_date || !args.end_date) {
    throw new Error('site_url, start_date, and end_date are required');
  }

  const requestBody: Record<string, unknown> = {
    startDate: args.start_date,
    endDate: args.end_date,
  };

  if (args.dimensions) requestBody.dimensions = args.dimensions;
  if (args.search_type) requestBody.type = args.search_type;
  if (args.data_state) requestBody.dataState = args.data_state;
  if (args.aggregation_type) requestBody.aggregationType = args.aggregation_type;
  if (args.row_limit) requestBody.rowLimit = args.row_limit;
  if (args.start_row) requestBody.startRow = args.start_row;
  if (args.dimension_filter_groups) {
    requestBody.dimensionFilterGroups = args.dimension_filter_groups.map(
      (group) => ({
        groupType: group.group_type || 'and',
        filters: group.filters.map((f) => ({
          dimension: f.dimension,
          operator: f.operator,
          expression: f.expression,
        })),
      })
    );
  }

  const data = await client.querySearchAnalytics(args.site_url, requestBody as any);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
