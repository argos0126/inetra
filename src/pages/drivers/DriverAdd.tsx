import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusToggle } from "@/components/StatusToggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Info, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { 
  isValidEmail, 
  checkUniqueDriverMobile, 
  checkUniqueLicenseNumber,
  checkUniqueDriverAadhaar,
  checkUniqueDriverPAN,
  checkUniqueDriverEmail
} from "@/utils/validationUtils";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

// Validation schema
const driverSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  mobile: z.string()
    .regex(/^[6-9]\d{9}$/, "Enter valid 10-digit Indian mobile number")
    .length(10, "Mobile must be 10 digits"),
  license_number: z.string()
    .min(10, "License number must be at least 10 characters")
    .regex(/^[A-Z]{2}[-]?\d{2}[-]?\d{4}[-]?\d{7}$/, "Invalid license format (e.g., DL-1420110012345 or DL1420110012345)"),
  license_issue_date: z.string().optional(),
  license_expiry_date: z.string().min(1, "License expiry date is required"),
  aadhaar_number: z.string()
    .regex(/^\d{12}$/, "Aadhaar must be 12 digits")
    .or(z.literal("")),
  pan_number: z.string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format (e.g., ABCDE1234F)")
    .or(z.literal("")),
});

interface ValidationErrors {
  name?: string;
  mobile?: string;
  email?: string;
  license_number?: string;
  license_issue_date?: string;
  license_expiry_date?: string;
  aadhaar_number?: string;
  pan_number?: string;
}

export default function DriverAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transporters, setTransporters] = useState<{ id: string; transporter_name: string }[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const createLoginAccount = true; // Always create login account
  
  const [formData, setFormData] = useState({
    name: "", mobile: "", email: "", transporter_id: "", is_dedicated: false, location_code: "",
    license_number: "", license_issue_date: "", license_expiry_date: "",
    consent_status: "not_requested",
    aadhaar_number: "", aadhaar_verified: false, pan_number: "", pan_verified: false,
    voter_id: "", passport_number: "",
    police_verification_date: "", police_verification_expiry: "",
    is_active: true
  });

  useEffect(() => {
    supabase.from("transporters").select("id, transporter_name").eq("is_active", true)
      .then(({ data }) => { if (data) setTransporters(data); });
  }, []);

  // Helper to check if Aadhaar is valid (12 digits)
  const isAadhaarValid = (value: string) => /^\d{12}$/.test(value);
  
  // Helper to check if PAN is valid
  const isPanValid = (value: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(value);

  // Real-time validation
  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };
    
    // Email validation for login account
    if (field === 'email') {
      if (createLoginAccount && !value) {
        newErrors.email = "Email is required for login account";
      } else if (value && !isValidEmail(value)) {
        newErrors.email = "Invalid email format";
      } else {
        delete newErrors.email;
      }
      setErrors(newErrors);
      return;
    }

    // License date cross-validation
    if (field === 'license_issue_date' || field === 'license_expiry_date') {
      const issueDate = field === 'license_issue_date' ? value : formData.license_issue_date;
      const expiryDate = field === 'license_expiry_date' ? value : formData.license_expiry_date;
      
      if (issueDate && expiryDate) {
        const issue = new Date(issueDate);
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (issue > today) {
          newErrors.license_issue_date = "Issue date cannot be in the future";
        } else if (issue >= expiry) {
          newErrors.license_issue_date = "Issue date must be before expiry date";
          newErrors.license_expiry_date = "Expiry date must be after issue date";
        } else {
          delete newErrors.license_issue_date;
          if (expiryDate) delete newErrors.license_expiry_date;
        }
      } else if (field === 'license_expiry_date' && !value) {
        newErrors.license_expiry_date = "License expiry is required";
      } else {
        delete newErrors.license_issue_date;
      }
      setErrors(newErrors);
      return;
    }
    
    try {
      const fieldSchema = {
        name: z.string().min(2, "Name must be at least 2 characters"),
        mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit mobile"),
        license_number: z.string()
          .min(10, "License number must be at least 10 characters")
          .regex(/^[A-Z]{2}[-]?\d{2}[-]?\d{4}[-]?\d{7}$/, "Invalid license format (e.g., DL-1420110012345)"),
        aadhaar_number: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits").or(z.literal("")),
        pan_number: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format").or(z.literal("")),
      }[field];
      
      if (fieldSchema) {
        fieldSchema.parse(value);
        delete newErrors[field as keyof ValidationErrors];
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors[field as keyof ValidationErrors] = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
  };

  const handleFieldChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    // Auto-uncheck verified if corresponding number is cleared or becomes invalid
    if (field === 'aadhaar_number' && !isAadhaarValid(value)) {
      newFormData.aadhaar_verified = false;
    }
    if (field === 'pan_number' && !isPanValid(value.toUpperCase())) {
      newFormData.pan_verified = false;
    }
    
    setFormData(newFormData);
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    validateField(field, formData[field as keyof typeof formData] as string);
  };

  // Check if license is expiring soon or expired
  const licenseExpiryStatus = useMemo(() => {
    if (!formData.license_expiry_date) return null;
    
    const today = new Date();
    const expiry = new Date(formData.license_expiry_date);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { type: 'expired', days: Math.abs(diffDays) };
    if (diffDays <= 30) return { type: 'expiring', days: diffDays };
    return { type: 'valid', days: diffDays };
  }, [formData.license_expiry_date]);

  // KYC completion status
  const kycStatus = useMemo(() => {
    const checks = {
      aadhaar: !!formData.aadhaar_number && formData.aadhaar_verified,
      pan: !!formData.pan_number && formData.pan_verified,
    };
    const complete = checks.aadhaar && checks.pan;
    return { ...checks, complete };
  }, [formData.aadhaar_number, formData.aadhaar_verified, formData.pan_number, formData.pan_verified]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email if creating login account
    if (createLoginAccount && !formData.email) {
      setErrors(prev => ({ ...prev, email: "Email is required for login account" }));
      toast({ title: "Validation Error", description: "Email is required to create a login account", variant: "destructive" });
      return;
    }

    if (createLoginAccount && formData.email && !isValidEmail(formData.email)) {
      setErrors(prev => ({ ...prev, email: "Invalid email format" }));
      toast({ title: "Validation Error", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    
    // Cross-validate license dates
    if (formData.license_issue_date && formData.license_expiry_date) {
      const issue = new Date(formData.license_issue_date);
      const expiry = new Date(formData.license_expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (issue > today) {
        setErrors(prev => ({ ...prev, license_issue_date: "Issue date cannot be in the future" }));
        toast({ title: "Validation Error", description: "License issue date cannot be in the future", variant: "destructive" });
        return;
      }
      if (issue >= expiry) {
        setErrors(prev => ({ ...prev, license_issue_date: "Issue date must be before expiry date" }));
        toast({ title: "Validation Error", description: "License issue date must be before expiry date", variant: "destructive" });
        return;
      }
    }

    // Validate all fields
    try {
      driverSchema.parse({
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        license_number: formData.license_number.trim(),
        license_issue_date: formData.license_issue_date,
        license_expiry_date: formData.license_expiry_date,
        aadhaar_number: formData.aadhaar_number.trim(),
        pan_number: formData.pan_number.trim().toUpperCase(),
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        const newErrors: ValidationErrors = {};
        e.errors.forEach(err => {
          const field = err.path[0] as keyof ValidationErrors;
          newErrors[field] = err.message;
        });
        setErrors(newErrors);
        setTouched({
          name: true, mobile: true, license_number: true, 
          license_expiry_date: true, aadhaar_number: true, pan_number: true
        });
        toast({ 
          title: "Validation Error", 
          description: "Please fix the highlighted errors", 
          variant: "destructive" 
        });
        return;
      }
    }

    setLoading(true);
    try {
      // Check for duplicates including email
      const [mobileUnique, licenseUnique, aadhaarUnique, panUnique, emailUnique] = await Promise.all([
        checkUniqueDriverMobile(formData.mobile.trim()),
        formData.license_number.trim() ? checkUniqueLicenseNumber(formData.license_number.trim()) : Promise.resolve(true),
        formData.aadhaar_number.trim() ? checkUniqueDriverAadhaar(formData.aadhaar_number.trim()) : Promise.resolve(true),
        formData.pan_number.trim() ? checkUniqueDriverPAN(formData.pan_number.trim()) : Promise.resolve(true),
        formData.email.trim() ? checkUniqueDriverEmail(formData.email.trim()) : Promise.resolve(true)
      ]);

      const duplicateErrors: string[] = [];
      if (!mobileUnique) duplicateErrors.push("Mobile number already exists");
      if (!licenseUnique) duplicateErrors.push("License number already exists");
      if (!aadhaarUnique) duplicateErrors.push("Aadhaar number already exists");
      if (!panUnique) duplicateErrors.push("PAN number already exists");
      if (!emailUnique) duplicateErrors.push("Email already exists");

      if (duplicateErrors.length > 0) {
        toast({ 
          title: "Duplicate Entry", 
          description: duplicateErrors.join(", "), 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      const { data: driverData, error } = await supabase.from("drivers").insert({
        name: formData.name.trim(), 
        mobile: formData.mobile.trim(),
        email: formData.email.trim() || null,
        transporter_id: formData.transporter_id || null, 
        is_dedicated: formData.is_dedicated,
        location_code: formData.location_code || null,
        license_number: formData.license_number.trim() || null,
        license_issue_date: formData.license_issue_date || null,
        license_expiry_date: formData.license_expiry_date || null,
        consent_status: formData.consent_status as any,
        aadhaar_number: formData.aadhaar_number.trim() || null, 
        aadhaar_verified: formData.aadhaar_verified,
        pan_number: formData.pan_number.trim().toUpperCase() || null, 
        pan_verified: formData.pan_verified,
        voter_id: formData.voter_id.trim() || null, 
        passport_number: formData.passport_number.trim() || null,
        police_verification_date: formData.police_verification_date || null,
        police_verification_expiry: formData.police_verification_expiry || null,
        is_active: formData.is_active
      }).select().single();
      
      if (error) throw error;

      // Create login account if checkbox is checked
      if (createLoginAccount && formData.email && driverData) {
        const { data: userResult, error: userError } = await supabase.functions.invoke("create-entity-user", {
          body: {
            email: formData.email,
            entityType: "driver",
            entityId: driverData.id,
            firstName: formData.name.split(" ")[0],
            lastName: formData.name.split(" ").slice(1).join(" ") || "",
            roleName: "Viewer"
          }
        });

        if (userError) {
          logError(userError, "DriverAdd - CreateUserAccount");
          toast({ 
            title: "Warning", 
            description: "Driver created but login account creation failed. Please contact administrator.",
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Success", 
            description: "Driver created with login account (Viewer role)" 
          });
          navigate("/drivers");
          return;
        }
      }

      toast({ title: "Success", description: "Driver created successfully" });
      navigate("/drivers");
    } catch (error: any) {
      logError(error, "DriverAdd");
      toast({ title: "Error", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/drivers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Driver</h1>
            <p className="text-muted-foreground">Create a new driver record</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Required fields are marked with *</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleFieldBlur('name')}
                    className={errors.name && touched.name ? "border-destructive" : ""}
                    placeholder="Enter driver name"
                  />
                  {errors.name && touched.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Mobile *</Label>
                  <Input 
                    value={formData.mobile} 
                    onChange={(e) => handleFieldChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onBlur={() => handleFieldBlur('mobile')}
                    className={errors.mobile && touched.mobile ? "border-destructive" : ""}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                  />
                  {errors.mobile && touched.mobile && (
                    <p className="text-sm text-destructive">{errors.mobile}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    className={errors.email ? "border-destructive" : ""}
                    placeholder="Enter email address"
                    required={createLoginAccount}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Transporter</Label>
                  <Select 
                    value={formData.transporter_id} 
                    onValueChange={(v) => setFormData({ ...formData, transporter_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select transporter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {transporters.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.transporter_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Location Code</Label>
                  <Input 
                    value={formData.location_code} 
                    onChange={(e) => setFormData({ ...formData, location_code: e.target.value })} 
                    placeholder="e.g., DEL, MUM"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Consent Status</Label>
                  <Select 
                    value={formData.consent_status} 
                    onValueChange={(v) => setFormData({ ...formData, consent_status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_requested">Not Requested</SelectItem>
                      <SelectItem value="requested">Requested</SelectItem>
                      <SelectItem value="granted">Granted</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox 
                    checked={formData.is_dedicated} 
                    onCheckedChange={(c) => setFormData({ ...formData, is_dedicated: !!c })} 
                  />
                  <Label>Dedicated Driver</Label>
                </div>
              </CardContent>
            </Card>

            {/* License & KYC */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>License & KYC Documents</CardTitle>
                    <CardDescription>Compliance documents are required for trip assignment</CardDescription>
                  </div>
                  {kycStatus.complete ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">KYC Complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="text-sm font-medium">KYC Incomplete</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="license">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="license" className="relative">
                      License
                      {(errors.license_number || errors.license_expiry_date) && touched.license_number && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="kyc">KYC Documents</TabsTrigger>
                    <TabsTrigger value="police">Police Verification</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="license" className="space-y-4 mt-4">
                    {licenseExpiryStatus && licenseExpiryStatus.type === 'expired' && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          License expired {licenseExpiryStatus.days} days ago. Driver cannot be assigned to trips.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {licenseExpiryStatus && licenseExpiryStatus.type === 'expiring' && (
                      <Alert className="border-orange-500/50 bg-orange-500/10">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-700">
                          License expires in {licenseExpiryStatus.days} days. Please renew soon.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>License Number *</Label>
                        <Input 
                          value={formData.license_number} 
                          onChange={(e) => handleFieldChange('license_number', e.target.value.toUpperCase())}
                          onBlur={() => handleFieldBlur('license_number')}
                          className={errors.license_number && touched.license_number ? "border-destructive" : ""}
                          placeholder="e.g., DL-1420110012345"
                        />
                        {errors.license_number && touched.license_number && (
                          <p className="text-sm text-destructive">{errors.license_number}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Issue Date</Label>
                        <Input 
                          type="date" 
                          value={formData.license_issue_date} 
                          onChange={(e) => handleFieldChange('license_issue_date', e.target.value)}
                          onBlur={() => handleFieldBlur('license_issue_date')}
                          className={errors.license_issue_date && touched.license_issue_date ? "border-destructive" : ""}
                        />
                        {errors.license_issue_date && touched.license_issue_date && (
                          <p className="text-sm text-destructive">{errors.license_issue_date}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Expiry Date *</Label>
                        <Input 
                          type="date" 
                          value={formData.license_expiry_date} 
                          onChange={(e) => handleFieldChange('license_expiry_date', e.target.value)}
                          onBlur={() => handleFieldBlur('license_expiry_date')}
                          className={errors.license_expiry_date && touched.license_expiry_date ? "border-destructive" : ""}
                        />
                        {errors.license_expiry_date && touched.license_expiry_date && (
                          <p className="text-sm text-destructive">{errors.license_expiry_date}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="kyc" className="space-y-4 mt-4">
                    <Alert className="border-blue-500/50 bg-blue-500/10">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-700">
                        Both Aadhaar and PAN verification are required for KYC compliance.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Aadhaar Number</Label>
                        <Input 
                          value={formData.aadhaar_number} 
                          onChange={(e) => handleFieldChange('aadhaar_number', e.target.value.replace(/\D/g, '').slice(0, 12))}
                          onBlur={() => handleFieldBlur('aadhaar_number')}
                          className={errors.aadhaar_number && touched.aadhaar_number ? "border-destructive" : ""}
                          placeholder="12-digit Aadhaar number"
                          maxLength={12}
                        />
                        {errors.aadhaar_number && touched.aadhaar_number && (
                          <p className="text-sm text-destructive">{errors.aadhaar_number}</p>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-1 pt-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={formData.aadhaar_verified} 
                            onCheckedChange={(c) => setFormData({ ...formData, aadhaar_verified: !!c })}
                            disabled={!isAadhaarValid(formData.aadhaar_number)}
                          />
                          <Label className={`flex items-center gap-2 ${!isAadhaarValid(formData.aadhaar_number) ? 'text-muted-foreground' : ''}`}>
                            Aadhaar Verified
                            {formData.aadhaar_verified && <CheckCircle className="h-4 w-4 text-green-500" />}
                          </Label>
                        </div>
                        {!isAadhaarValid(formData.aadhaar_number) && (
                          <p className="text-xs text-muted-foreground">Enter valid 12-digit Aadhaar to verify</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>PAN Number</Label>
                        <Input 
                          value={formData.pan_number} 
                          onChange={(e) => handleFieldChange('pan_number', e.target.value.toUpperCase().slice(0, 10))}
                          onBlur={() => handleFieldBlur('pan_number')}
                          className={errors.pan_number && touched.pan_number ? "border-destructive" : ""}
                          placeholder="e.g., ABCDE1234F"
                          maxLength={10}
                        />
                        {errors.pan_number && touched.pan_number && (
                          <p className="text-sm text-destructive">{errors.pan_number}</p>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-1 pt-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={formData.pan_verified} 
                            onCheckedChange={(c) => setFormData({ ...formData, pan_verified: !!c })}
                            disabled={!isPanValid(formData.pan_number)}
                          />
                          <Label className={`flex items-center gap-2 ${!isPanValid(formData.pan_number) ? 'text-muted-foreground' : ''}`}>
                            PAN Verified
                            {formData.pan_verified && <CheckCircle className="h-4 w-4 text-green-500" />}
                          </Label>
                        </div>
                        {!isPanValid(formData.pan_number) && (
                          <p className="text-xs text-muted-foreground">Enter valid PAN to verify</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Voter ID</Label>
                        <Input 
                          value={formData.voter_id} 
                          onChange={(e) => setFormData({ ...formData, voter_id: e.target.value.toUpperCase() })} 
                          placeholder="Optional"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Passport Number</Label>
                        <Input 
                          value={formData.passport_number} 
                          onChange={(e) => setFormData({ ...formData, passport_number: e.target.value.toUpperCase() })} 
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="police" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Verification Date</Label>
                      <Input 
                        type="date" 
                        value={formData.police_verification_date} 
                        onChange={(e) => setFormData({ ...formData, police_verification_date: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input 
                        type="date" 
                        value={formData.police_verification_expiry} 
                        onChange={(e) => setFormData({ ...formData, police_verification_expiry: e.target.value })} 
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Login Account Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Login Account
                </CardTitle>
                <CardDescription>
                  A login account with <span className="font-semibold text-primary">Viewer</span> role will be created for this driver
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A temporary password will be generated and a password reset email will be sent to the driver's email address.
                  The driver will have read-only access to view trips.
                </p>
              </CardContent>
            </Card>

            <StatusToggle isActive={formData.is_active} onToggle={(v) => setFormData({ ...formData, is_active: v })} />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate("/drivers")}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Driver"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}