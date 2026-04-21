import { Plus, Calendar, Clock, MoreVertical, Play, Square } from "lucide-react";

export default function CampaignManagementUI() {
  const mockCampaigns = [
    { id: 1, name: "April Promo - Macchiato", status: "active", expiresAt: "2026-04-30", totalCustomers: 1250 },
    { id: 2, name: "Staff Appreciation", status: "inactive", expiresAt: "2026-03-15", totalCustomers: 45 },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden backdrop-blur space-y-0">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">Campaigns</h2>
          <p className="text-sm text-muted-foreground font-body">Manage promotional campaigns & validity.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-brass text-primary-foreground font-semibold rounded-lg font-body text-sm transition-transform hover:scale-105">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/10">
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Campaign Name</th>
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Expires</th>
              <th className="px-6 py-4 text-left text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Recipients</th>
              <th className="px-6 py-4 text-right text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockCampaigns.map((camp) => (
              <tr key={camp.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="px-6 py-4 font-body font-medium text-foreground">{camp.name}</td>
                <td className="px-6 py-4">
                   <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-medium ${
                     camp.status === 'active' ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                   }`}>
                     {camp.status === 'active' ? <Play className="w-3 h-3 mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                     {camp.status}
                   </span>
                </td>
                <td className="px-6 py-4 font-body text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {camp.expiresAt}
                </td>
                <td className="px-6 py-4 font-body text-sm text-foreground">{camp.totalCustomers}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
