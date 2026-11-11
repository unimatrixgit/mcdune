import {staffAreasFor} from '../control-panel/public/page-groups.mjs';
export const isStaffMailAccess=access=>!!access&&staffAreasFor({rank:access.rank,ranks:access.ranks,permissions:access.nodes}).length>0;
