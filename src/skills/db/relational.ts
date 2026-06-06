/**
 * @file Skill: db:relational-planner
 */

import type { SkillDefinition } from '../types.js';

export interface RelationalPlannerInput {
  schemaSql: string;
  dialect: 'sqlite' | 'postgres';
}

export interface RelationalPlannerOutput {
  isValidSyntax: boolean;
  missingRelations: string[];
  score: number;
}

export const relationalPlannerSkill: SkillDefinition<RelationalPlannerInput, RelationalPlannerOutput> = {
  name: 'db:relational-planner',
  description: 'Audits schemas and schema creation scripts for Postgres/SQLite.',

  async execute(input) {
    try {
      const sql = input.schemaSql || '';
      
      if (sql.trim().length === 0) {
        return {
          isValidSyntax: true,
          missingRelations: [],
          score: 100
        };
      }

      // Check simple syntax issues like unclosed parentheses
      const openParens = (sql.match(/\(/g) || []).length;
      const closeParens = (sql.match(/\)/g) || []).length;
      const isValidSyntax = openParens === closeParens;

      if (!isValidSyntax) {
        return {
          isValidSyntax: false,
          missingRelations: [],
          score: 0
        };
      }

      // Find defined tables
      const tableMatches = sql.match(/CREATE\s+TABLE\s+([a-zA-Z0-9_]+)/gi) || [];
      const tables = tableMatches.map(m => m.replace(/CREATE\s+TABLE\s+/i, '').trim());

      // Simple audit for foreign key relationships: look for keywords "REFERENCES" or "FOREIGN KEY"
      const missingRelations: string[] = [];
      let deductions = 0;

      // If schema contains references to id fields in other tables, but lacks REFERENCES
      for (const table of tables) {
        // e.g., if we see user_id but no REFERENCES users(id)
        const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+${table}\\s*\\(([^)]+)\\)`, 'i');
        const match = sql.match(tableRegex);
        if (match) {
          const columnsText = match[1];
          const hasForeignKey = columnsText.toLowerCase().includes('references') || 
                               columnsText.toLowerCase().includes('foreign key');
          
          // Heuristic check: if there is a column name ending in _id (excluding primary keys), we expect a foreign key
          const hasIdColumn = columnsText.split(',').some(col => {
            const colTrim = col.trim().toLowerCase();
            return colTrim.includes('_id') && !colTrim.startsWith('id ') && !colTrim.startsWith('id\t');
          });

          if (hasIdColumn && !hasForeignKey) {
            missingRelations.push(`Table "${table}" contains id columns but lacks FOREIGN KEY / REFERENCES constraints`);
            deductions += 20;
          }
        }
      }

      let score = 100 - deductions;
      score = Math.max(0, Math.min(100, score));

      return {
        isValidSyntax,
        missingRelations,
        score
      };
    } catch (e) {
      return {
        isValidSyntax: false,
        missingRelations: [],
        score: 0
      };
    }
  }
};
