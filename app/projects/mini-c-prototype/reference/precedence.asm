.data

.text
# function main
# int main()
.globl main
main:
# function prologue
#  make room for $fp old value
addi $sp,$sp,-4
#  Push frame pointer onto the stack
sw $fp,0($sp)
#  initialize this frame's $fp
addiu $fp,$sp,0
addiu $sp,$sp,-4
addiu $sp,$sp,-4
sw $t0,0($sp)
addiu $sp,$sp,-4
sw $t1,0($sp)
addiu $sp,$sp,-4
sw $t2,0($sp)
# function body
# Copy return value on the stack
li $t2,4
li $t1,2
li $t0,3
mult $t1,$t0
mflo $t0
addu $t0,$t2,$t0
sw $t0,4($fp)
j main_epilogue
# function epilogue
main_epilogue:
lw $t2,0($sp)
addiu $sp,$sp,4
lw $t1,0($sp)
addiu $sp,$sp,4
lw $t0,0($sp)
addiu $sp,$sp,4
# restore stack pointer
addi $sp,$fp,4
# restore frame pointer
lw $fp,0($fp)

# main exit syscall
li $v0,10
syscall

