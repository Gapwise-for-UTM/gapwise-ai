# Migration plan

The production database migration is additive. It introduces AI delegation state alongside the existing encrypted private-cloud tables and does not alter or decrypt existing private data. Rollback drops only AI-specific objects after delegation is disabled.
