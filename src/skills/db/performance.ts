/**
 * @file Skill: db:performance-index
 */

import type { SkillDefinition } from '../types.js';

export interface PerformanceIndexInput {
  schemaSql: string;
  expectedQueries: string[];
}

export interface PerformanceIndexOutput {
  unindexedQueries: string[];
  score: number;
}

export const performanceIndexSkill: SkillDefinition<PerformanceIndexInput, PerformanceIndexOutput> = {
  name: 'db:performance-index',
  description: 'Inspects relational tables for proper index configurations.',

  async execute(input) {
    try {
      const sql = input.schemaSql || '';
      const expectedQueries = input.expectedQueries || [];

      if (expectedQueries.length === 0) {
        return {
          unindexedQueries: [],
          score: 100
        };
      }

      // Extract created indexes from SQL
      const indexMatches = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:[a-zA-Z0-9_]+\s+)?ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi) || [];
      
      interface IndexDefinition {
        table: string;
        columns: string[];
      }
      
      const indexes: IndexDefinition[] = indexMatches.map(idxMatch => {
        const parts = /ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i.exec(idxMatch);
        if (parts) {
          return {
            table: parts[1].toLowerCase(),
            columns: parts[2].split(',').map(c => c.trim().toLowerCase().replace(/['"`]/g, ''))
          };
        }
        return { table: '', columns: [] };
      }).filter(idx => idx.table.length > 0);

      const unindexedQueries: string[] = [];
      let deductions = 0;

      // Analyze expected queries (heuristically parsing WHERE clauses)
      for (const query of expectedQueries) {
        const queryLower = query.toLowerCase();
        
        // Find table in SELECT ... FROM table WHERE ...
        const fromMatch = /from\s+([a-zA-Z0-9_]+)/i.exec(queryLower);
        if (!fromMatch) continue;
        const table = fromMatch[1];

        // Find WHERE columns
        const whereIdx = queryLower.indexOf('where');
        if (whereIdx === -1) continue; // No where clause, full table scan but not indexed
        
        const whereClause = queryLower.substring(whereIdx + 5);
        
        // Find columns compared in the WHERE clause, e.g. column = ? or column = val
        const colMatches = whereClause.match(/([a-zA-Z0-9_]+)\s*(?:=|in|like|>=|<=|>|<)/g) || [];
        const whereCols = colMatches.map(m => m.replace(/\s*(?:=|in|like|>=|<=|>|<)/i, '').trim());

        if (whereCols.length > 0) {
          // Check if there is an index on this table covering at least one of the queried columns
          const hasIndex = indexes.some(idx => 
            idx.table === table && idx.columns.some(col => whereCols.includes(col))
          );

          if (!hasIndex) {
            unindexedQueries.push(`Query "${query}" filters on unindexed column(s) [${whereCols.join(', ')}] in table "${table}"`);
            deductions += 25;
          }
        }
      }

      let score = 100 - deductions;
      score = Math.max(0, Math.min(100, score));

      return {
        unindexedQueries,
        score
      };
    } catch (e) {
      return {
        unindexedQueries: [],
        score: 100
      };
    }
  }
};
