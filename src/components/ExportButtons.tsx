import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { exportToExcel, exportToPDF, exportToCSV } from "@/utils/exportUtils";
import { toast } from "@/hooks/use-toast";

interface ExportColumn {
  key: string;
  label: string;
}

interface ExportButtonsProps {
  filename: string;
  title?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButtons({
  filename,
  title,
  columns,
  data,
  variant = "outline",
  size = "sm"
}: ExportButtonsProps) {
  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to export.",
        variant: "destructive"
      });
      return;
    }

    try {
      const options = { filename, title, columns, data };
      
      switch (format) {
        case 'excel':
          exportToExcel(options);
          toast({ title: "Export Successful", description: `${filename}.xlsx has been downloaded.` });
          break;
        case 'pdf':
          exportToPDF(options);
          toast({ title: "Export Successful", description: `${filename}.pdf has been downloaded.` });
          break;
        case 'csv':
          exportToCSV(options);
          toast({ title: "Export Successful", description: `${filename}.csv has been downloaded.` });
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data.",
        variant: "destructive"
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          Export to Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2 text-red-600" />
          Export to PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileDown className="h-4 w-4 mr-2 text-blue-600" />
          Export to CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
