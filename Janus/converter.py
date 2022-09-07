import subprocess
from os.path import abspath,join
recording_directory='recordings'

def create_files_map(recording_directory):
    process = subprocess.Popen(['ls', recording_directory],
                     stdout=subprocess.PIPE, 
                     encoding='utf-8',
                     universal_newlines=True,
                     stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()                 
    mjr_files={}
    for file_name in stdout.split('\n'):
        if file_name!='':
            [file_name_without_extension,extension]=file_name.split('.')
            splitted_string=file_name_without_extension.split('-')
            if (extension=='mjr' or extension=='wav') and len(splitted_string)==3:
                [call_id,owner,type]=splitted_string
                if call_id not in mjr_files:
                    mjr_files[call_id]={'call_id':call_id,'files':[{
                        'owner':owner,
                        'type':type,
                        'recording_directory':recording_directory,
                        'extension':extension,
                        'file_name_without_extension':file_name_without_extension,
                        'file_name':file_name}]}
                else:
                    mjr_files[call_id]['files'].append({
                        'owner':owner,
                        'type':type,
                        'recording_directory':recording_directory,
                        'extension':extension,
                        'file_name_without_extension':file_name_without_extension,
                        'file_name':file_name}) 
    return mjr_files

def convert_to_wav_files(files):
    for file in files:
        if file['extension']== 'mjr':
            file_path=abspath(join(file['recording_directory'],file['file_name']))
            target_path=abspath(join(file['recording_directory'],file['file_name_without_extension']))        
            process = subprocess.Popen('janus-pp-rec {file_name} {file_name_without_extension}.wav'.format(file_name=file_path,file_name_without_extension=target_path),
                            stdout=subprocess.PIPE, 
                            encoding='utf-8',
                            universal_newlines=True,
                            shell=True,
                            stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()
            print(stdout)
            print(file_path)
            print(stderr)
            process = subprocess.Popen('rm -rf {file_name}'.format(file_name=file_path),
                            stdout=subprocess.PIPE, 
                            encoding='utf-8',
                            universal_newlines=True,
                            shell=True,
                            stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()
            print(stdout)
            print(stderr)
def merge_wav_files(first_file,second_file,target_path):
    command='ffmpeg -y -i {first_file} -i {second_file} -filter_complex amix=inputs=2:duration=first:dropout_transition=2 {target_path}'
    process = subprocess.Popen(command.format(first_file=first_file,second_file=second_file,target_path=target_path),
                    stdout=subprocess.PIPE, 
                    encoding='utf-8',
                    universal_newlines=True,
                    shell=True,
                    stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    print(stdout)
    print(stderr)
    process = subprocess.Popen('rm -f {first_file} {second_file}'.format(first_file=first_file,second_file=second_file),
                    stdout=subprocess.PIPE, 
                    encoding='utf-8',
                    universal_newlines=True,
                    shell=True,
                    stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    print(stdout)
    print(stderr)


# main block

files={}
files=create_files_map(recording_directory)
for key,val in files.items():
    convert_to_wav_files(val['files'])
files=create_files_map(recording_directory)
for key,val in files.items():
    [file_one,file_two]=val['files']
    file_one_path=abspath(join(file_one['recording_directory'],file_one['file_name']))
    file_two_path=abspath(join(file_two['recording_directory'],file_two['file_name']))
    target_path=abspath(join(file_two['recording_directory'],val['call_id']))+'.wav'
    
    print(file_one_path)
    print(file_two_path)
    print(target_path)
    merge_wav_files(file_one_path,file_two_path,target_path)    



