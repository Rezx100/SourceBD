/**
 * REZ-114 — build SiteWorkerInput[] from profile + facility panel payloads.
 */
import type { FacilityPanel } from "./format-facility-group";
import {
  headlineWorkers,
  type GroupWorkersResult,
  type SelectedWorkers,
  type SiteWorkerInput,
} from "./profile-metrics";

export type RscSiteLike = {
  workers_count?: number | null;
  fetched_at?: string | null;
  building_name?: string | null;
};

export function motherRscWorkers(
  sites: RscSiteLike[] | null | undefined,
): { count: number | null; fetchedAt: string | null } {
  if (!sites?.length) return { count: null, fetchedAt: null };
  const mother = sites.find((s) => !s.building_name);
  if (!mother) return { count: null, fetchedAt: null };
  return {
    count: mother.workers_count ?? null,
    fetchedAt: mother.fetched_at ?? null,
  };
}

export function buildWorkerSites(args: {
  companyName: string;
  employeesTotal: number | null;
  rscSites: RscSiteLike[] | null | undefined;
  panel: FacilityPanel | null;
}): { mother: SiteWorkerInput; buildings: SiteWorkerInput[] } {
  const mr = motherRscWorkers(args.rscSites);
  const mother: SiteWorkerInput = {
    label: args.companyName,
    employees_total: args.employeesTotal,
    rsc_workers_count: mr.count,
    rsc_fetched_at: mr.fetchedAt,
  };
  const buildings: SiteWorkerInput[] = [];
  if (args.panel?.facilities?.length) {
    for (const f of args.panel.facilities) {
      const rsc = f.rsc;
      buildings.push({
        label: f.name,
        employees_total:
          (f as { employees_total?: number | null }).employees_total ?? null,
        rsc_workers_count: rsc?.workers_count ?? null,
        rsc_fetched_at:
          (rsc as { fetched_at?: string | null } | null)?.fetched_at ?? null,
      });
    }
  }
  return { mother, buildings };
}

export function resolveProfileWorkers(args: {
  companyName: string;
  employeesTotal: number | null;
  rscSites: RscSiteLike[] | null | undefined;
  panel: FacilityPanel | null;
}): SelectedWorkers | GroupWorkersResult {
  const { mother, buildings } = buildWorkerSites(args);
  return headlineWorkers(mother, buildings);
}
