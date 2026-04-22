import { useEffect, useState } from "react";
import { Plus, Calendar, MoreVertical, Play, Square, Loader2, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Campaign {
  id: string;
  name: string;
  active: boolean;
  start_at: string | null;
  end_at: string | null;
  count?: number;
}

export default function CampaignManagementUI() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gift_campaigns")
      .select(`
        *,
        gift_recipients(count)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCampaigns(data.map(c => ({
        ...c,
        count: Array.isArray(c.gift_recipients) ? c.gift_recipients[0]?.count || 0 : 0
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;

    const { error } = await supabase
      .from("gift_campaigns")
      .insert({ name: newCampaignName, active: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Campaign created successfully" });
      setNewCampaignName("");
      setIsCreating(false);
      fetchCampaigns();
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("gift_campaigns")
      .update({ active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchCampaigns();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Recipients linked to this campaign will stay but lose the link.`)) return;

    const { error } = await supabase
      .from("gift_campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Campaign removed" });
      fetchCampaigns();
    }
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden backdrop-blur space-y-0">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">Campaigns</h2>
          <p className="text-sm text-muted-foreground font-body">Manage promotional campaigns & validity.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-brass text-primary-foreground font-semibold rounded-lg font-body text-sm transition-transform hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-4 bg-secondary/20 border-b border-border"
          >
            <form onSubmit={handleCreate} className="flex gap-4 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-body font-semibold text-muted-foreground uppercase">Campaign Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Eid Mubarak Special"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button type="submit" className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                <Check className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setIsCreating(false)} className="p-2.5 rounded-lg bg-secondary text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-0 overflow-x-auto">
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
            {campaigns.map((camp) => (
              <tr key={camp.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors group">
                <td className="px-6 py-4 font-body font-medium text-foreground">{camp.name}</td>
                <td className="px-6 py-4">
                   <button 
                    onClick={() => toggleActive(camp.id, camp.active)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-medium transition-colors ${
                      camp.active ? "bg-success/10 text-success hover:bg-success/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                   >
                     {camp.active ? <Play className="w-3 h-3 mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                     {camp.active ? 'Active' : 'Inactive'}
                   </button>
                </td>
                <td className="px-6 py-4 font-body text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {camp.end_at ? new Date(camp.end_at).toLocaleDateString() : "No Expiry"}
                </td>
                <td className="px-6 py-4 font-body text-sm text-foreground">{camp.count}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleDelete(camp.id, camp.name)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-body text-sm">
                  No campaigns found. Create your first one to start importing!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
