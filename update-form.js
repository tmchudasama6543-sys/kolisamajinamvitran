const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'yuva matirial', 'koli samaj inam vitran 2026', 'koli samaj inam vitran 2026 app', 'src', 'components', 'data-entry-form.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The new return block
const newReturn = `  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-4 sm:p-10 max-w-4xl mx-auto space-y-8 pb-64">
      <div className="pb-10 border-b-8 border-slate-50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-emerald-600 tracking-tighter flex items-center gap-2 py-1 leading-tight">નવી વિદ્યાર્થી એન્ટ્રી</h1>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">બધી વિગતો ભરો</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-10 space-y-5 sm:space-y-6 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            
            <FormField control={form.control} name="studentName" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">👤 વિદ્યાર્થીનું નામ</FormLabel>
                <FormControl>
                  <Input placeholder="નામ લખો..." {...field} className="h-14 font-black text-lg sm:text-xl text-slate-900 rounded-2xl border-2 px-6 bg-slate-50/30" />
                </FormControl>
                <FormMessage className="font-bold text-rose-500" />
              </FormItem>
            )} />

            <FormField control={form.control} name="standard" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">🎓 ધોરણ</FormLabel>
                <FormControl>
                  <SearchableSelect options={academicStandards} value={field.value} onSelect={field.onChange} placeholder="ધોરણ પસંદ કરો..." label="ધોરણ" />
                </FormControl>
                <FormMessage className="font-bold text-rose-500" />
              </FormItem>
            )} />

            <FormField control={form.control} name="villageName" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">📍 ગામનું નામ</FormLabel>
                <FormControl>
                  <SearchableSelect options={palitanaVillages} value={field.value} onSelect={field.onChange} placeholder="ગામ પસંદ કરો..." label="ગામ" />
                </FormControl>
                <FormMessage className="font-bold text-rose-500" />
              </FormItem>
            )} />

            <FormField control={form.control} name="mobileNumber" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-black uppercase text-emerald-600 tracking-widest px-1">📱 મોબાઈલ નંબર</FormLabel>
                <FormControl>
                  <Input type="tel" maxLength={10} placeholder="૧૦ આંકડાનો નંબર" {...field} onChange={(e) => {
                    const val = e.target.value.replace(/\\D/g, '');
                    if (val.length <= 10) field.onChange(val);
                  }} className="h-14 font-black text-lg sm:text-xl text-slate-900 rounded-2xl border-2 px-6 bg-emerald-50/10" />
                </FormControl>
                <FormMessage className="font-bold text-rose-500" />
              </FormItem>
            )} />

            <FormField control={form.control} name="obtainedMarks" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">✅ મેળવેલ ગુણ</FormLabel>
                <FormControl>
                  <Input type="number" {...field} className="h-14 font-black text-lg sm:text-xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
                </FormControl>
                <FormMessage className="font-bold text-rose-500" />
              </FormItem>
            )} />

            <FormField control={form.control} name="totalMarks" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">📊 કુલ ગુણ</FormLabel>
                <FormControl>
                  <Input type="number" {...field} className="h-14 font-black text-lg sm:text-xl text-slate-900 text-center rounded-2xl border-2 bg-slate-50/30" />
                </FormControl>
                <FormMessage className="font-bold text-rose-500" />
              </FormItem>
            )} />

            <div className="space-y-3 pt-2">
              <label className="text-[11px] font-black text-emerald-600 tracking-widest px-1 block">% ટકાવારી</label>
              <div className="bg-emerald-500 text-white font-black px-6 py-4 rounded-2xl text-center text-2xl sm:text-3xl font-mono border-2 border-emerald-600 shadow-xl shadow-emerald-100 transition-all">
                {percentage ? \`\${percentage}%\` : '0.00%'}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-10">
              <Button type="button" variant="outline" onClick={() => form.reset()} className="h-16 rounded-2xl font-black border-2 text-xl sm:w-1/3">રદ કરો</Button>
              <Button type="submit" disabled={isSubmitting} className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-xl text-xl flex items-center justify-center gap-3 flex-1">
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                માહિતી સેવ કરો
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </motion.div>
  );`;

content = content.replace(/  return \([\s\S]*?  \);\n\}/, newReturn + '\n}');

fs.writeFileSync(filePath, content);
